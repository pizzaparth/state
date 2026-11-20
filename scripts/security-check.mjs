#!/usr/bin/env node
/**
 * Black-box security regression suite for the deployed surfaces: marketing pages, owner
 * sign-in, the demo (which runs in the browser and must get nothing from the server) and
 * the product's Server Actions (as the owner). Run against a production build backed by
 * a disposable database:
 *
 *   OWNER_CODE=… npm run build && OWNER_CODE=… PORT=3123 npm start
 *   BASE_URL=http://localhost:3123 DATABASE_URL=postgresql://me@localhost/state_security_test \
 *     node scripts/security-check.mjs
 *
 * Exits non-zero if any check fails. Never point it at production: it signs in as the
 * owner, changes the owner's data and deliberately triggers rate limits. Tenant
 * isolation (IDOR) is covered at the database layer by scripts/authz-check.ts.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { isSafeRedirectPath } from "../lib/auth/redirect.ts";

const BASE = (process.env.BASE_URL || "http://localhost:3123").replace(/\/$/, "");
const ORIGIN = new URL(BASE).origin;
const results = [];
const db = process.env.DATABASE_URL ? new pg.Client({ connectionString: process.env.DATABASE_URL }) : null;

function record(id, name, pass, detail = "") {
  results.push({ id, name, pass, detail });
}

async function req(path, { method = "GET", headers = {}, body, raw } = {}) {
  const init = { method, headers: { ...headers }, redirect: "manual" };
  if (body !== undefined) {
    init.body = raw ? body : JSON.stringify(body);
    if (!raw) init.headers["content-type"] = "application/json";
  }
  const res = await fetch(BASE + path, init);
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

// IPv6 documentation range, a distinct /64 per call and per run, so repeated runs do not
// inherit each other's per-IP limits
const runId = Math.floor(Math.random() * 0xffff).toString(16);
let ipCounter = 0;
const nextIp = () => `2001:db8:${runId}:${(ipCounter++).toString(16)}::1`;

const sessionCookie = (res) =>
  (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .filter((c) => c.includes("session_token") && !c.endsWith("="))
    .join("; ");

// ---------------------------------------------------------------- Server Actions
// Server Actions are public POST endpoints addressed by an id embedded in client chunks.
// These checks replay them directly, the way an attacker would, bypassing the UI.
async function actionIdOn(path, name, cookie) {
  const page = await req(path, { headers: cookie ? { cookie } : {} });
  for (const m of page.text.matchAll(/<script[^>]+src="([^"]+\.js)"/g)) {
    const js = (await req(m[1].startsWith("http") ? new URL(m[1]).pathname : m[1])).text;
    // `name` is one of this script's own action names, never outside input
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    const id = js.match(new RegExp(`"([0-9a-f]{40,42})",[^"]{0,120}?"${name}"`))?.[1];
    if (id) return id;
  }
  return null;
}

async function callAction(id, args, { cookie, origin = ORIGIN, path = "/platform/board", ip = nextIp() } = {}) {
  const headers = { "next-action": id, "content-type": "text/plain;charset=UTF-8", accept: "text/x-component", "x-forwarded-for": ip };
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  const res = await req(path, { method: "POST", body: JSON.stringify(args), raw: true, headers });
  // The response is an RSC stream: row 0 points at the action's result row ("a":"$@<row>").
  // It may also carry the page tree, whose props include unrelated "error" keys.
  const row = res.text.match(/"a":"\$@([0-9a-f]+)"/)?.[1];
  let result = null;
  try {
    const line = row ? res.text.split("\n").find((l) => l.startsWith(`${row}:`)) : null;
    result = line ? JSON.parse(line.slice(row.length + 1)) : null;
  } catch {
    result = null;
  }
  const ok = result ? result.ok === true : /"ok":true/.test(res.text);
  const error = result ? (result.error ?? null) : (res.text.match(/"error":"([^"]*)"/)?.[1] ?? null);
  return { status: res.status, ok, error, text: res.text, headers: res.headers };
}

/** A demo's only server-visible trace: its marker cookie (lib/demo/cookie.ts). */
const DEMO_COOKIE = `state_demo=${crypto.randomUUID()}`;

let ownerSession = null;
/** Signs in as the owner (OWNER_CODE) from a fresh IP and returns the session cookie. */
async function signInOwner() {
  if (ownerSession !== null) return ownerSession;
  ownerSession = "";
  if (!process.env.OWNER_CODE) return ownerSession;
  const id = await actionIdOn("/login", "signInOwnerAction");
  if (!id) return ownerSession;
  const res = await callAction(id, [{ code: process.env.OWNER_CODE }], { path: "/login" });
  ownerSession = sessionCookie(res);
  return ownerSession;
}

// ---------------------------------------------------------------- headers
async function checkHeaders() {
  for (const path of ["/", "/login", "/demo", "/principles", "/compare"]) {
    const res = await req(path);
    const h = res.headers;
    const csp = h.get("content-security-policy") || "";
    const missing = [];
    if (!/frame-ancestors 'none'/.test(csp)) missing.push("CSP frame-ancestors");
    // These pages are prerendered, so they cannot carry a nonce: their CSP (next.config.ts)
    // allows inline scripts but no eval and no other origin. Product pages use the nonce
    // CSP from middleware.ts.
    if (!/script-src 'self'(?: 'unsafe-inline')?(?:;|$)/.test(csp)) missing.push("CSP script-src beyond 'self' and inline");
    if (!/object-src 'none'/.test(csp)) missing.push("CSP object-src");
    if (!/base-uri 'self'/.test(csp)) missing.push("CSP base-uri");
    if (h.get("x-frame-options") !== "DENY") missing.push("X-Frame-Options");
    if (h.get("x-content-type-options") !== "nosniff") missing.push("X-Content-Type-Options");
    if (!h.get("referrer-policy")) missing.push("Referrer-Policy");
    if (!h.get("permissions-policy")) missing.push("Permissions-Policy");
    if (!/max-age=\d{8,}/.test(h.get("strict-transport-security") || "")) missing.push("HSTS");
    if (h.get("x-powered-by")) missing.push("X-Powered-By present");
    record("H1", `Security headers on ${path}`, missing.length === 0, missing.join(", "));
  }
}

// ---------------------------------------------------------------- reflected XSS
async function checkReflectedXss() {
  const payload = `"><script>alert(1)</script><img src=x onerror=alert(1)>`;
  const enc = encodeURIComponent(payload);
  for (const path of [`/login?next=${enc}`, `/demo?x=${enc}`, `/?q=${enc}`, `/compare?x=${enc}`]) {
    const res = await req(path);
    const reflected = res.text.includes("<script>alert(1)</script>") || res.text.includes("onerror=alert(1)>");
    record("X1", `No reflected XSS: ${path.split("?")[0]}`, !reflected, reflected ? "payload echoed unescaped" : "");
  }
}

// ---------------------------------------------------------------- open redirect
function checkOpenRedirect() {
  const evil = ["//evil.example", "/\\evil.example", "\\\\evil.example", "https://evil.example", "javascript:alert(1)", "/%2F%2Fevil.example", "/\t/evil.example", " //evil.example", "data:text/html,hi"];
  const good = ["/platform/today", "/platform/projects/thesis?tab=metrics"];
  const leaked = evil.filter((p) => isSafeRedirectPath(p));
  const blocked = good.filter((p) => !isSafeRedirectPath(p));
  record("R1", "Login ?next= rejects off-site targets", leaked.length === 0, leaked.join(" | "));
  record("R2", "Login ?next= keeps same-site paths", blocked.length === 0, blocked.join(" | "));
}

// ---------------------------------------------------------------- access control and removed surfaces
async function checkAccessControl() {
  const anon = await req("/platform/today");
  record("A1", "Product route without session redirects to sign-in", anon.status === 307 && /\/login/.test(anon.headers.get("location") || ""), `${anon.status}`);

  const forged = await req("/platform/today", { headers: { cookie: "better-auth.session_token=forged.forged" } });
  const loc = forged.headers.get("location") || "";
  record("A2", "Forged session cookie is rejected", [303, 307, 308].includes(forged.status) && /\/login/.test(loc), `${forged.status} ${loc}`);

  // Sign-up, password sign-in, billing, organisations and email flows no longer exist
  const gone = [];
  for (const [method, path] of [
    ["POST", "/api/auth/sign-up/email"],
    ["POST", "/api/auth/sign-in/email"],
    ["POST", "/api/auth/request-password-reset"],
    ["GET", "/api/auth/get-session"],
    ["POST", "/api/billing/checkout"],
    ["POST", "/api/webhooks/razorpay"],
    ["POST", "/api/webhooks/stripe"],
    ["GET", "/register"],
    ["GET", "/subscribe"],
    ["GET", "/pricing"],
    ["GET", "/legal/privacy"],
    ["GET", "/forgot-password"],
    ["GET", "/invite/abc"],
  ]) {
    const res = await req(path, { method, body: method === "POST" ? {} : undefined, headers: { origin: ORIGIN, "x-forwarded-for": nextIp() } });
    if (res.status !== 404) gone.push(`${method} ${path} ${res.status}`);
  }
  record("G1", "Sign-up, password, billing, invitation and legal endpoints answer 404", gone.length === 0, gone.join("; "));
}

// ---------------------------------------------------------------- owner sign-in
async function checkOwnerCode() {
  const id = await actionIdOn("/login", "signInOwnerAction");
  record("OC0", "Owner sign-in action id discovered", Boolean(id));
  if (!id) return;
  const wrong = await callAction(id, [{ code: "not-the-code" }], { path: "/login" });
  record("OC1", "A wrong owner code is refused without a session", !wrong.ok && !sessionCookie(wrong), wrong.error ?? `${wrong.status}`);
  const extra = await callAction(id, [{ code: "x", userId: "owner" }], { path: "/login" });
  const huge = await callAction(id, [{ code: "x".repeat(10_000) }], { path: "/login" });
  record("OC2", "Extra fields and oversized codes are refused", !extra.ok && !huge.ok, `${extra.error} | ${huge.error}`);
  const ip = nextIp();
  const tries = [];
  for (let i = 0; i < 7; i++) tries.push(await callAction(id, [{ code: `guess-${i}` }], { path: "/login", ip }));
  const throttledAt = tries.findIndex((r) => /Too many attempts/.test(r.error ?? "")) + 1;
  record("OC3", "Owner code guessing from one IP is throttled", throttledAt > 0 && throttledAt <= 6, throttledAt ? `throttled at attempt ${throttledAt}` : "never throttled");
  const csrf = await callAction(id, [{ code: "x" }], { path: "/login", origin: "https://evil.example" });
  record("OC4", "Cross-site owner sign-in is refused (CSRF)", !csrf.ok, `${csrf.status}`);
}

// ---------------------------------------------------------------- demo
// A demo lives in the visitor's browser (PGlite in IndexedDB). The server only sees its
// marker cookie, which must open the page shell and nothing else.
async function checkDemo() {
  const page = await req("/demo");
  record("DM0", "Starting a demo sets no server cookie", page.status === 200 && (page.headers.getSetCookie?.() ?? []).length === 0, `${page.status}`);

  const today = await req("/platform/today", { headers: { cookie: DEMO_COOKIE } });
  const cc = today.headers.get("cache-control") || "";
  record("DM1", "A demo cookie opens the product shell, private and no-store", today.status === 200 && /no-store/.test(cc) && !/public/.test(cc), `${today.status} ${cc}`);

  const usersBefore = db ? Number((await db.query("select count(*) from users")).rows[0].count) : 0;
  // A demo page loads its shell lazily; the owner's page carries the action ids up front
  const owner = await signInOwner();
  const captureId = (owner && (await actionIdOn("/platform/inbox", "captureTaskAction", owner))) || (await actionIdOn("/platform/inbox", "captureTaskAction", DEMO_COOKIE));
  const write = captureId ? await callAction(captureId, [{ text: "from a demo cookie" }], { cookie: DEMO_COOKIE, path: "/platform/inbox" }) : null;
  const usersAfter = db ? Number((await db.query("select count(*) from users")).rows[0].count) : 0;
  record("DM2", "A demo cookie alone cannot write through a Server Action", Boolean(write) && !write.ok && usersAfter === usersBefore, write ? write.error ?? `${write.status}` : "action id not found");

  const leaks = [];
  for (const path of ["/api/search?q=thesis", "/api/export?format=json"]) {
    const res = await req(path, { headers: { cookie: DEMO_COOKIE } });
    if (res.status !== 401) leaks.push(`${path} ${res.status}`);
  }
  const imp = await req("/api/import", { method: "POST", raw: true, body: "title\nx", headers: { cookie: DEMO_COOKIE, origin: ORIGIN, "content-type": "text/csv" } });
  if (imp.status !== 401) leaks.push(`/api/import ${imp.status}`);
  record("DM3", "A demo cookie alone reads and imports nothing from the API", leaks.length === 0, leaks.join("; "));

  const bad = await req("/platform/today", { headers: { cookie: "state_demo=not-a-demo-id" } });
  record("DM4", "A malformed demo cookie is sent to sign-in", [303, 307, 308].includes(bad.status) && /\/login/.test(bad.headers.get("location") || ""), `${bad.status}`);
}

// ---------------------------------------------------------------- product Server Actions (owner)
async function checkActions() {
  const owner = await signInOwner();
  record("SA0", "Owner session for Server Action checks (needs OWNER_CODE)", Boolean(owner));
  if (!owner) return;
  const orgPage = await req("/platform/org", { headers: { cookie: owner } });
  record("DM5", "Organisation pages do not exist", orgPage.status === 404, `${orgPage.status}`);
  if (!db) {
    record("SA0b", "Server Action data checks need DATABASE_URL (test database)", false);
    return;
  }

  const moveId = await actionIdOn("/platform/board", "moveTaskAction", owner);
  const addId = await actionIdOn("/platform/board", "addBoardTaskAction", owner);
  const captureId = await actionIdOn("/platform/inbox", "captureTaskAction", owner);
  const commitId = await actionIdOn("/platform/board", "createCommitAction", owner);
  record("SA0c", "Product Server Action ids discovered", Boolean(moveId && addId && captureId && commitId));
  if (!moveId || !addId || !captureId || !commitId) return;

  const added = await callAction(addId, [{ title: "Security check card", weight: 2 }], { cookie: owner });
  const { rows: [victim] } = await db.query("select id, workspace_id from tasks where title = 'Security check card' and deleted_at is null order by created_at desc limit 1");
  record("SA6", "The owner's own write succeeds and persists", added.ok && Boolean(victim), added.error ?? "");
  if (!victim) return;
  const { rows: [doneCol] } = await db.query(`select c.id from columns c join boards b on b.id = c.board_id where b.workspace_id = $1 and c.state_type = 'done'`, [victim.workspace_id]);
  const { rows: [activeCol] } = await db.query(`select c.id from columns c join boards b on b.id = c.board_id where b.workspace_id = $1 and c.state_type = 'active'`, [victim.workspace_id]);
  const state = async () => JSON.stringify((await db.query("select column_id, position, completed_at from tasks where id = $1", [victim.id])).rows[0]);
  const commitCount = async () => Number((await db.query("select count(*) from commits")).rows[0].count);
  const move = { taskId: victim.id, columnId: doneCol.id, afterTaskId: null };
  const before = await state();
  const commitsBefore = await commitCount();

  const anonPublic = await callAction(moveId, [move], { path: "/" });
  const anonProduct = await callAction(moveId, [move]);
  record("SA1", "Anonymous Server Action call is refused", !anonPublic.ok && !anonProduct.ok && (await state()) === before, `${anonPublic.status} ${anonProduct.status}`);
  const forgedCookie = await callAction(moveId, [move], { cookie: "better-auth.session_token=forged.forged" });
  record("SA1b", "Forged session cookie on a Server Action is refused", !forgedCookie.ok && (await state()) === before, forgedCookie.error ?? `${forgedCookie.status}`);
  const csrf = await callAction(moveId, [move], { cookie: owner, origin: "https://evil.example" });
  record("SA3", "Cross-site Server Action call is refused (CSRF)", !csrf.ok && (await state()) === before, `${csrf.status}`);
  const forgedCommit = await callAction(commitId, [{ message: "forged", projectId: null, weight: 2, userId: "someone-else", source: "imported" }], { cookie: owner });
  record("SA4", "Extra fields (userId, source) refused on commit", !forgedCommit.ok && (await commitCount()) === commitsBefore, forgedCommit.error ?? "");
  const pricey = await callAction(commitId, [{ message: "inflate", projectId: null, weight: 1_000_000 }], { cookie: owner });
  record("SA5", "Inflated execution value refused", !pricey.ok && (await commitCount()) === commitsBefore, pricey.error ?? "");
  const legit = await callAction(moveId, [{ taskId: victim.id, columnId: activeCol.id, afterTaskId: null }], { cookie: owner });
  const { rows: [after] } = await db.query("select column_id from tasks where id = $1", [victim.id]);
  record("SA7", "A move persists", legit.ok && after.column_id === activeCol.id, legit.error ?? "");

  const payload = `<img src=x onerror=alert(1)><script>alert(2)</script>`;
  const xss = await callAction(captureId, [{ text: payload }], { cookie: owner, path: "/platform/inbox" });
  const inboxHtml = (await req("/platform/inbox", { headers: { cookie: owner } })).text;
  record("X2", "Stored XSS in a captured task title is escaped", xss.ok && !inboxHtml.includes("<img src=x onerror") && !inboxHtml.includes("<script>alert(2)"), xss.error ?? "");

  const burst = await Promise.all(Array.from({ length: 70 }, () => callAction(moveId, [{}], { cookie: owner })));
  const limited = burst.filter((r) => /Too many changes/.test(r.error ?? "")).length;
  record("SA8", "Write burst is rate limited per user", limited >= 10, `${limited} of 70 limited`);

  // Sign-out ends the session: its token stops working
  const signOutId = await actionIdOn("/platform/settings/account", "signOutAction", owner);
  const out = signOutId ? await callAction(signOutId, [], { cookie: owner, path: "/platform/settings/account" }) : null;
  const reuse = await req("/platform/today", { headers: { cookie: owner } });
  record("SO1", "Signing out kills the session token", Boolean(out?.ok) && [303, 307, 308].includes(reuse.status), `${out?.status} ${reuse.status}`);
}

// ---------------------------------------------------------------- exposure surface
function readEnvFile() {
  try {
    const text = readFileSync(new URL("../.env", import.meta.url), "utf8");
    return Object.fromEntries([...text.matchAll(/^([A-Z0-9_]+)="?([^"\n]*)"?/gm)].map((m) => [m[1], m[2]]));
  } catch {
    return {};
  }
}

async function checkSurface() {
  const cookie = DEMO_COOKIE;
  const chunks = new Set();
  for (const path of ["/", "/login", "/demo", "/platform/today", "/platform/board", "/platform/inbox", "/platform/settings/account"]) {
    const page = await req(path, { headers: cookie ? { cookie } : {} });
    for (const m of page.text.matchAll(/<script[^>]+src="([^"]+\.js)"/g)) chunks.add(m[1]);
  }
  const leaks = [];
  const patterns = [
    [/postgres(ql)?:\/\/[^"'\s]+/, "database URL"],
    // The demo runs Drizzle on PGlite in the browser; the server's drivers never ship
    [/pg-pool|@neondatabase|drizzle-orm\/neon|drizzle-orm\/node-postgres|better-auth\/adapters/, "server-only module"],
  ];
  // The real secret values this deployment was configured with, the owner code included
  const secretValues = Object.entries({ ...readEnvFile(), ...(process.env.OWNER_CODE ? { OWNER_CODE: process.env.OWNER_CODE } : {}) })
    .filter(([k, v]) => !k.startsWith("NEXT_PUBLIC_") && /SECRET|KEY|PASSWORD|TOKEN|DATABASE_URL|OWNER_CODE/.test(k) && v.length >= 8);
  let mapsServed = 0;
  for (const src of chunks) {
    const path = src.startsWith("http") ? new URL(src).pathname : src;
    const js = (await req(path)).text;
    for (const [re, label] of patterns) if (re.test(js)) leaks.push(`${label} in ${path}`);
    for (const [k, v] of secretValues) if (js.includes(v)) leaks.push(`value of ${k} in ${path}`);
    if ((await req(`${path}.map`)).status === 200) mapsServed++;
  }
  record("F1", `No secrets or server modules in ${chunks.size} client chunks`, chunks.size > 0 && leaks.length === 0, leaks.slice(0, 3).join("; "));
  record("F2", "Production source maps are not served", mapsServed === 0, `${mapsServed} maps`);

  const cors = [];
  for (const path of ["/api/health", "/api/search?q=ab", "/api/export"]) {
    const res = await req(path, { method: "OPTIONS", headers: { origin: "https://evil.example", "access-control-request-method": "POST" } });
    const acao = res.headers.get("access-control-allow-origin");
    if (acao === "*" && res.headers.get("access-control-allow-credentials") === "true") cors.push(`${path} wildcard+credentials`);
    if (acao === "https://evil.example") cors.push(`${path} reflects origin`);
  }
  record("CO1", "CORS does not trust foreign origins", cors.length === 0, cors.join("; "));

  if (cookie) {
    const deception = await req("/platform/today/style.css", { headers: { cookie } });
    record("CA2", "Static-looking suffix on a private page is not served as a cacheable asset", deception.status !== 200 || /no-store/.test(deception.headers.get("cache-control") || ""), `${deception.status}`);
  }

  const hidden = [];
  for (const path of ["/api/auth/delete-user", "/api/auth/update-user", "/api/auth/admin/list-users", "/api/admin", "/api/debug", "/graphql", "/api/graphql", "/swagger", "/openapi.json", "/.env", "/.git/config"]) {
    const res = await req(path, { method: path.startsWith("/api/auth") ? "POST" : "GET", body: path.startsWith("/api/auth") ? {} : undefined, headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) } });
    if (res.status === 200) hidden.push(`${path} ${res.status}`);
  }
  record("E1", "No admin, debug, schema or dotfile endpoints answer", hidden.length === 0, hidden.join("; "));
  const health = await req("/api/health");
  record("E2", "Health check discloses no versions or internals", !/version|node|next|postgres|uptime/i.test(health.text), health.text);
}

async function main() {
  if (db) await db.connect();
  await checkHeaders();
  await checkReflectedXss();
  checkOpenRedirect();
  await checkAccessControl();
  await checkOwnerCode();
  await checkDemo();
  await checkSurface();
  await checkActions();
  if (db) await db.end();

  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id.padEnd(4)} ${r.name}${r.detail && (!r.pass || process.env.VERBOSE) ? `  — ${r.detail}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});

#!/usr/bin/env node
/**
 * Black-box security regression suite for the public surfaces (marketing, auth,
 * billing entry points). Run against a production build backed by a disposable
 * database:
 *
 *   BASE_URL=http://localhost:3123 DATABASE_URL=postgresql://me@localhost/state_security_test \
 *     node scripts/security-check.mjs
 *
 * Exits non-zero if any check fails. Never point it at production: it creates
 * accounts and deliberately triggers rate limits.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
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

// IPv6 documentation range, a distinct /64 per request and per run, so repeated runs
// do not inherit each other's per-IP limits
const runId = Math.floor(Math.random() * 0xffff).toString(16);
let ipCounter = 0;
const nextIp = () => `2001:db8:${runId}:${(ipCounter++).toString(16)}::1`;

const authPost = (path, body, extra = {}) =>
  req(`/api/auth${path}`, { method: "POST", body, headers: { origin: ORIGIN, "x-forwarded-for": nextIp(), ...extra } });

const sessionCookie = (res) =>
  (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .filter((c) => c.includes("session_token"))
    .join("; ");

// ---------------------------------------------------------------- email outbox
// The server under test runs with EMAIL_OUTBOX_DIR (local URLs only, see lib/env.ts) and
// writes each message as JSON there; these helpers read links out of it.
const OUTBOX = process.env.EMAIL_OUTBOX_DIR ? path.resolve(process.env.EMAIL_OUTBOX_DIR) : null;

function outbox(to) {
  if (!OUTBOX) return [];
  let files = [];
  try {
    files = readdirSync(OUTBOX).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
  const messages = [];
  for (const f of files) {
    // A message still being written is picked up on the next poll
    try {
      messages.push(JSON.parse(readFileSync(path.join(OUTBOX, f), "utf8")));
    } catch {}
  }
  return messages.filter((m) => m.to === to);
}

/** Waits for the next message to `to` matching `subject` (mail is sent after the response). */
async function nextEmail(to, subject, seen = 0) {
  for (let i = 0; i < 50; i++) {
    const matching = outbox(to).filter((m) => subject.test(m.subject));
    if (matching.length > seen) return matching.at(-1);
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

const linkIn = (message) => message?.text.match(/https?:\/\/\S+/)?.[0] ?? null;

/** Signs up and follows the emailed verification link; returns the session cookie. */
async function verifiedSignUp(email, password = "correct-horse-battery-1", extra = {}) {
  const res = await authPost("/sign-up/email", { name: "Test User", email, password, callbackURL: "/verify-email", ...extra });
  const link = linkIn(await nextEmail(email, /Verify your email/));
  if (!link) return { res, cookie: "", link: null };
  const verify = await req(new URL(link).pathname + new URL(link).search);
  return { res, cookie: sessionCookie(verify), link, verify };
}

const uniqueEmail = (tag) => `sec-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

// ---------------------------------------------------------------- headers
async function checkHeaders() {
  for (const path of ["/", "/login", "/register", "/pricing", "/legal/privacy"]) {
    const res = await req(path);
    const h = res.headers;
    const csp = h.get("content-security-policy") || "";
    const missing = [];
    if (!/frame-ancestors 'none'/.test(csp)) missing.push("CSP frame-ancestors");
    if (!/script-src[^;]*'nonce-/.test(csp)) missing.push("CSP script nonce");
    if (/script-src[^;]*'unsafe-inline'(?![^;]*'nonce-)/.test(csp)) missing.push("CSP allows unsafe-inline scripts");
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
  for (const path of [
    `/login?next=${enc}`,
    `/register?plan=${enc}&interval=${enc}`,
    `/subscribe?canceled=${enc}`,
    `/?q=${enc}`,
    `/legal/terms?x=${enc}`,
  ]) {
    const res = await req(path);
    const reflected = res.text.includes("<script>alert(1)</script>") || res.text.includes("onerror=alert(1)>");
    record("X1", `No reflected XSS: ${path.split("?")[0]}`, !reflected, reflected ? "payload echoed unescaped" : "");
  }
}

// ---------------------------------------------------------------- open redirect
function checkOpenRedirect() {
  const evil = [
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "/%2F%2Fevil.example",
    "/\t/evil.example",
    " //evil.example",
    "data:text/html,hi",
  ];
  const good = ["/platform/today", "/platform/projects/relaydb?tab=metrics", "/subscribe?plan=organisation"];
  const leaked = evil.filter((p) => isSafeRedirectPath(p));
  const blocked = good.filter((p) => !isSafeRedirectPath(p));
  record("R1", "Login ?next= rejects off-site targets", leaked.length === 0, leaked.join(" | "));
  record("R2", "Login ?next= keeps same-site paths", blocked.length === 0, blocked.join(" | "));
}

// ---------------------------------------------------------------- access control
async function checkAccessControl() {
  const anon = await req("/platform/today");
  record("A1", "Product route without session redirects to sign-in", anon.status === 307 && /\/login/.test(anon.headers.get("location") || ""), `${anon.status}`);

  const forged = await req("/platform/today", { headers: { cookie: "better-auth.session_token=forged.forged" } });
  const loc = forged.headers.get("location") || "";
  record("A2", "Forged session cookie is rejected", [303, 307, 308].includes(forged.status) && /\/login/.test(loc), `${forged.status} ${loc}`);

  // Same-origin requests, so these isolate the session check from the CSRF guard
  const checkout = await req("/api/billing/checkout", { method: "POST", body: { plan: "individual" }, headers: { origin: ORIGIN } });
  record("A3", "Checkout requires a session", checkout.status === 401, `${checkout.status}`);

  const verify = await req("/api/billing/razorpay/verify", { method: "POST", body: {}, headers: { origin: ORIGIN } });
  record("A4", "Payment verification requires a session", verify.status === 401, `${verify.status}`);

  const getCheckout = await req("/api/billing/checkout");
  record("A5", "Checkout rejects GET", getCheckout.status === 405, `${getCheckout.status}`);
}

// ---------------------------------------------------------------- webhooks
async function checkWebhooks() {
  const body = JSON.stringify({ event: "subscription.activated", payload: { subscription: { entity: { id: "sub_x", status: "active", notes: { userId: "victim", plan: "individual" } } } } });
  const none = await req("/api/webhooks/razorpay", { method: "POST", body, raw: true });
  record("W1", "Razorpay webhook without signature rejected", none.status === 400, `${none.status}`);
  const bad = await req("/api/webhooks/razorpay", { method: "POST", body, raw: true, headers: { "x-razorpay-signature": "0".repeat(64) } });
  record("W2", "Razorpay webhook with forged signature rejected", bad.status === 400, `${bad.status}`);
  const stripe = await req("/api/webhooks/stripe", { method: "POST", body: "{}", raw: true, headers: { "stripe-signature": "t=1,v1=deadbeef" } });
  record("W3", "Stripe webhook with forged signature rejected", stripe.status === 400, `${stripe.status}`);
}

// ---------------------------------------------------------------- auth endpoints
async function checkAuth() {
  // CSRF: cross-site origin must not be able to drive auth endpoints
  const csrf = await authPost("/sign-in/email", { email: "a@example.test", password: "whatever-123" }, { origin: "https://evil.example" });
  record("C1", "Sign-in rejects cross-site Origin (CSRF)", csrf.status === 403, `${csrf.status}`);
  const csrfUp = await authPost("/sign-up/email", { name: "x", email: uniqueEmail("csrf"), password: "correct-horse-1" }, { origin: "https://evil.example" });
  record("C2", "Sign-up rejects cross-site Origin (CSRF)", csrfUp.status === 403, `${csrfUp.status}`);

  // Password policy
  const short = await authPost("/sign-up/email", { name: "x", email: uniqueEmail("short"), password: "short" });
  record("P1", "Sign-up rejects short password", short.status === 400, `${short.status}`);
  const huge = await authPost("/sign-up/email", { name: "x", email: uniqueEmail("huge"), password: "a".repeat(10_000) });
  record("P2", "Sign-up rejects 10k-char password (hash DoS)", huge.status === 400, `${huge.status}`);

  // Injection payloads must fail cleanly, never 5xx
  const sqli = await authPost("/sign-in/email", { email: "' OR 1=1 --@example.test", password: "' OR '1'='1" });
  record("S1", "SQL injection payload in sign-in fails cleanly", sqli.status >= 400 && sqli.status < 500, `${sqli.status}`);
  const nosql = await authPost("/sign-in/email", { email: { $ne: null }, password: { $ne: null } });
  record("S2", "Object/operator injection in sign-in fails cleanly", nosql.status >= 400 && nosql.status < 500, `${nosql.status}`);

  // Mass assignment: privileged fields in the sign-up body must be ignored
  const email = uniqueEmail("mass");
  const signUp = await authPost("/sign-up/email", {
    name: "Mass Assign",
    email,
    password: "correct-horse-battery-1",
    subscriptionStatus: "active",
    subscriptionPlan: "organisation",
    emailVerified: true,
    defaultWorkspaceId: "attacker",
    id: "attacker-chosen-id",
  });
  record("M0", "Sign-up with valid input succeeds", signUp.status === 200, `${signUp.status} ${signUp.text.slice(0, 120)}`);
  record("EV1", "Sign-up opens no session before the email is verified", sessionCookie(signUp) === "", sessionCookie(signUp) ? "session cookie set" : "");
  if (db) {
    const { rows } = await db.query(
      "select id, subscription_status, subscription_plan, email_verified, default_workspace_id from users where email = $1",
      [email]
    );
    const u = rows[0];
    const bad = !u
      ? ["user missing"]
      : [
          u.subscription_status !== "none" && `subscription_status=${u.subscription_status}`,
          u.subscription_plan && `subscription_plan=${u.subscription_plan}`,
          u.email_verified && "email_verified=true",
          u.default_workspace_id && `default_workspace_id=${u.default_workspace_id}`,
          u.id === "attacker-chosen-id" && "id chosen by client",
        ].filter(Boolean);
    record("M1", "Sign-up ignores privileged fields (mass assignment)", bad.length === 0, bad.join(", "));
  }

  // The verification link is what signs a new user in
  const massLink = linkIn(await nextEmail(email, /Verify your email/));
  const verified = massLink ? await req(new URL(massLink).pathname + new URL(massLink).search) : null;

  // Session cookie flags
  const cookie = (verified?.headers.getSetCookie?.() ?? []).find((c) => c.includes("session_token")) || "";
  const flags = [!/HttpOnly/i.test(cookie) && "HttpOnly", !/SameSite=(Lax|Strict)/i.test(cookie) && "SameSite", !/Path=\//i.test(cookie) && "Path"].filter(Boolean);
  record("K1", "Session cookie is HttpOnly + SameSite", cookie !== "" && flags.length === 0, cookie ? `missing ${flags.join(", ")}` : "no cookie set");

  // Paywall: an authenticated but unpaid user cannot reach the product
  const session = verified ? sessionCookie(verified) : "";
  if (session) {
    const today = await req("/platform/today", { headers: { cookie: session } });
    record("A6", "Unpaid session is sent to checkout", [303, 307, 308].includes(today.status) && /\/subscribe/.test(today.headers.get("location") || ""), `${today.status} ${today.headers.get("location")}`);

    const tamper = await req("/api/billing/checkout", { method: "POST", headers: { cookie: session, origin: ORIGIN }, body: { plan: "enterprise", seats: -5 } });
    record("V1", "Checkout rejects tampered plan/seats", tamper.status === 400, `${tamper.status}`);

    const big = await req("/api/billing/checkout", { method: "POST", headers: { cookie: session, origin: ORIGIN }, body: { plan: "individual", pad: "x".repeat(2_000_000) } });
    record("V2", "Checkout rejects oversized body", big.status === 413 || big.status === 400, `${big.status}`);

    const forgedPay = await req("/api/billing/razorpay/verify", {
      method: "POST",
      headers: { cookie: session, origin: ORIGIN },
      body: { razorpay_payment_id: "pay_x", razorpay_subscription_id: "sub_x", razorpay_signature: "0".repeat(64) },
    });
    record("V3", "Forged Razorpay payment confirmation rejected", forgedPay.status === 400 || forgedPay.status === 503, `${forgedPay.status}`);

    const crossOrigin = await req("/api/billing/checkout", { method: "POST", headers: { cookie: session, origin: "https://evil.example" }, body: { plan: "individual" } });
    record("C3", "Checkout rejects cross-site Origin (CSRF)", crossOrigin.status === 403, `${crossOrigin.status}`);

    if (db) {
      const { rows } = await db.query("select count(*)::int as n from subscriptions s join users u on u.id = s.user_id where u.email = $1 and s.status = 'active'", [email]);
      record("V4", "No active subscription without real payment", rows[0].n === 0, `${rows[0].n} active`);
    }
  }

  // Brute force: repeated failed sign-ins must be throttled
  const target = uniqueEmail("brute");
  let throttledAt = 0;
  for (let i = 1; i <= 12; i++) {
    const r = await authPost("/sign-in/email", { email: target, password: `wrong-password-${i}` }, { "x-forwarded-for": "203.0.113.7" });
    if (r.status === 429) {
      throttledAt = i;
      break;
    }
  }
  record("B1", "Sign-in brute force from one IP is rate limited", throttledAt > 0 && throttledAt <= 6, throttledAt ? `429 after ${throttledAt} attempts` : "never throttled in 12 attempts");

  // Credential stuffing: same account, every attempt from a different IP
  const victim = uniqueEmail("stuffing");
  let stuffedAt = 0;
  for (let i = 1; i <= 15; i++) {
    const r = await authPost("/sign-in/email", { email: victim, password: `guess-${i}-password` });
    if (r.status === 429) {
      stuffedAt = i;
      break;
    }
  }
  record("B2", "Per-account throttle survives IP rotation", stuffedAt > 0 && stuffedAt <= 11, stuffedAt ? `429 after ${stuffedAt} attempts` : "never throttled in 15 attempts");

  // Errors must not leak internals
  const broken = await req("/api/auth/sign-in/email", { method: "POST", body: "{not json", raw: true, headers: { "content-type": "application/json", origin: ORIGIN } });
  const leak = /at .*\.(js|ts):\d+|node_modules|stack/i.test(broken.text);
  record("I1", "Malformed request does not leak stack traces", broken.status < 500 && !leak, `${broken.status}${leak ? " stack leaked" : ""}`);
}

// ---------------------------------------------------------------- email verification and password reset
async function checkEmailFlows() {
  if (!OUTBOX) {
    record("EV0", "Email flow checks need EMAIL_OUTBOX_DIR on the server and this script", false);
    return;
  }
  const email = uniqueEmail("verify");
  const password = "correct-horse-battery-2";
  const signUp = await authPost("/sign-up/email", { name: "<img src=x onerror=alert(1)>", email, password, callbackURL: "/verify-email" });

  const early = await authPost("/sign-in/email", { email, password });
  record("EV2", "Unverified account cannot sign in", early.status === 403 && /EMAIL_NOT_VERIFIED/.test(early.text) && !sessionCookie(early), `${early.status}`);

  // A deliberately forged token: the check is that the server refuses it
  // nosemgrep: generic.secrets.security.detected-jwt-token.detected-jwt-token
  const forged = await req("/api/auth/verify-email?token=eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6InhAeC54In0.forged&callbackURL=/verify-email");
  record("EV3", "Forged verification token is rejected", !sessionCookie(forged) && /error=/.test(forged.headers.get("location") || ""), `${forged.status} ${forged.headers.get("location")}`);

  const link = linkIn(await nextEmail(email, /Verify your email/));
  const linkUrl = link ? new URL(link) : null;
  const first = linkUrl ? await req(linkUrl.pathname + linkUrl.search) : null;
  const second = linkUrl ? await req(linkUrl.pathname + linkUrl.search) : null;
  record(
    "EV4",
    "Verification link signs in once; replaying it opens no session",
    Boolean(first && sessionCookie(first)) && Boolean(second) && !sessionCookie(second),
    `first ${first?.status} ${first ? Boolean(sessionCookie(first)) : "-"}, second ${second ? Boolean(sessionCookie(second)) : "-"}`
  );
  record("EV5", "Verification link points at the configured origin", Boolean(linkUrl) && linkUrl.origin === ORIGIN, link ?? "no email");

  // Enumeration: an existing address answers exactly like a new one, and its owner is told
  const fresh = await authPost("/sign-up/email", { name: "New", email: uniqueEmail("fresh"), password });
  const dupe = await authPost("/sign-up/email", { name: "Dupe", email, password });
  const shape = (r) => `${r.status}:${Object.keys(JSON.parse(r.text || "{}")).sort().join(",")}:${Boolean(sessionCookie(r))}`;
  const notice = await nextEmail(email, /already have a State account/);
  record("EV6", "Sign-up with a registered email is indistinguishable (no enumeration)", shape(fresh) === shape(dupe) && Boolean(notice), `${shape(fresh)} vs ${shape(dupe)}`);
  void signUp;

  // ---- password reset
  const reset = (body, headers = {}) => authPost("/request-password-reset", body, headers);
  const known = await reset({ email, redirectTo: "/reset-password" });
  const unknown = await reset({ email: uniqueEmail("nobody"), redirectTo: "/reset-password" });
  record("PR1", "Reset request answers the same for unknown emails", known.status === unknown.status && known.text === unknown.text, `${known.status} vs ${unknown.status}`);
  const mailA = await nextEmail(email, /Reset your State password/);

  // Poisoning: the link must use the configured origin, never a forged Host
  const poisoned = await reset({ email, redirectTo: "/reset-password" }, { host: "evil.example", "x-forwarded-host": "evil.example" });
  const mailB = await nextEmail(email, /Reset your State password/, 1);
  const linkB = linkIn(mailB);
  record("PR2", "Reset link ignores forged Host / X-Forwarded-Host (reset poisoning)", Boolean(linkB) && new URL(linkB).origin === ORIGIN, `${poisoned.status} ${linkB}`);

  const offsite = await reset({ email, redirectTo: "https://evil.example/steal" });
  record("PR3", "Reset redirect to another origin is refused", offsite.status === 403 || offsite.status === 400, `${offsite.status}`);

  // Limit is 3 per address per hour; every request comes from a different IP
  const statuses = [];
  for (let i = 0; i < 3; i++) statuses.push((await reset({ email, redirectTo: "/reset-password" })).status);
  record("PR4", "Reset mail per address is throttled across IPs", statuses.includes(429), statuses.join(","));

  // Token from the emailed link: /api/auth/reset-password/<token>?callbackURL=…
  const tokenOf = (link) => link && new URL(link).pathname.split("/").pop();
  const tokenA = tokenOf(linkIn(mailA));
  const landing = await req(new URL(linkIn(mailA)).pathname + new URL(linkIn(mailA)).search);
  record("PR5", "Reset link lands on the reset page with the token", /\/reset-password\?token=/.test(landing.headers.get("location") || ""), landing.headers.get("location") || `${landing.status}`);

  const sessionBefore = await signIn(email, password);
  const liveBefore = (await req("/api/auth/get-session", { headers: { cookie: sessionBefore } })).text.includes(email);
  const weak = await authPost("/reset-password", { newPassword: "short", token: tokenA });
  record("PR6", "Reset rejects a weak new password", weak.status === 400, `${weak.status}`);
  const newPassword = "brand-new-password-3";
  const used = await authPost("/reset-password", { newPassword, token: tokenA });
  const reused = await authPost("/reset-password", { newPassword: "another-password-4", token: tokenA });
  record("PR7", "Reset token works once", used.status === 200 && reused.status === 400, `${used.status} then ${reused.status}`);

  const oldSession = await req("/api/auth/get-session", { headers: { cookie: sessionBefore } });
  record("PR8", "Reset signs out every existing session", liveBefore && oldSession.status === 200 && oldSession.text.trim() === "null", `${oldSession.status} ${oldSession.text.slice(0, 60)}`);
  const oldPassword = await authPost("/sign-in/email", { email, password });
  const newLogin = await authPost("/sign-in/email", { email, password: newPassword });
  record("PR9", "Old password stops working, new one works", oldPassword.status === 401 && newLogin.status === 200, `${oldPassword.status} / ${newLogin.status}`);

  const tokenB = tokenOf(linkB);
  if (db && tokenB) await db.query("update verifications set expires_at = now() - interval '1 minute' where identifier = $1", [`reset-password:${tokenB}`]);
  const expired = await authPost("/reset-password", { newPassword: "expired-token-pass-5", token: tokenB });
  record("PR10", "Expired reset token is refused", expired.status === 400, `${expired.status}`);

  const guessed = await authPost("/reset-password", { newPassword: "guessed-token-pass", token: "a".repeat(24) });
  record("PR11", "Guessed reset token is refused", guessed.status === 400, `${guessed.status}`);

  const leaked = outbox(email).some((m) => /<img src=x onerror/i.test(m.html));
  record("PR12", "Emails escape user-supplied names", !leaked);
}

// ---------------------------------------------------------------- product Server Actions
// Server Actions are public POST endpoints addressed by an id embedded in client chunks.
// These checks replay them directly, the way an attacker would, bypassing the UI.
const DEMO_PASSWORD = "state-demo-2026";

async function signIn(email, password = DEMO_PASSWORD) {
  const res = await authPost("/sign-in/email", { email, password });
  return sessionCookie(res);
}

async function findActionIds(cookie) {
  const chunks = [];
  for (const path of ["/platform/personal", "/platform/inbox"]) {
    const page = await req(path, { headers: { cookie } });
    chunks.push(...[...page.text.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]));
  }
  const ids = {};
  for (const src of new Set(chunks)) {
    const js = (await req(src.startsWith("http") ? new URL(src).pathname : src)).text;
    for (const m of js.matchAll(/"([0-9a-f]{40,42})",[^"]{0,120}?"(moveTaskAction|captureTaskAction|createCommitAction)"/g)) ids[m[2]] = m[1];
  }
  return ids;
}

/** One action's id from the client chunks a page loads, or null. */
async function actionIdOn(path, name, cookie) {
  const page = await req(path, { headers: { cookie } });
  for (const m of page.text.matchAll(/<script[^>]+src="([^"]+\.js)"/g)) {
    const js = (await req(m[1].startsWith("http") ? new URL(m[1]).pathname : m[1])).text;
    // `name` is one of this script's own action names, never outside input
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    const id = js.match(new RegExp(`"([0-9a-f]{40,42})",[^"]{0,120}?"${name}"`))?.[1];
    if (id) return id;
  }
  return null;
}

async function callAction(id, args, { cookie, origin = ORIGIN, path = "/platform/personal", extraHeaders = {} } = {}) {
  const headers = { "next-action": id, "content-type": "text/plain;charset=UTF-8", accept: "text/x-component", ...extraHeaders };
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  const res = await req(path, { method: "POST", body: JSON.stringify(args), raw: true, headers });
  const ok = /"ok":true/.test(res.text);
  const error = res.text.match(/"error":"([^"]*)"/)?.[1] ?? null;
  return { status: res.status, ok, error, text: res.text };
}

async function checkServerActions() {
  if (!db) {
    record("SA0", "Server Action checks need DATABASE_URL (seeded test database)", false);
    return;
  }
  const owner = await signIn("demo@state.test");
  const other = await signIn("aarav@state.test");
  if (!owner || !other) {
    record("SA0", "Demo accounts sign in (run the seed on the test database)", false);
    return;
  }
  const ids = await findActionIds(owner);
  const found = ["moveTaskAction", "captureTaskAction", "createCommitAction"].filter((k) => ids[k]);
  record("SA0", "Server Action ids discovered from client chunks", found.length === 3, found.join(", "));
  if (found.length < 3) return;

  const { rows: [victim] } = await db.query(
    `select t.id, t.column_id, t.position, t.completed_at from tasks t join boards b on b.id = t.board_id
     where b.id = 'seed-board-parth' and t.completed_at is null and t.deleted_at is null limit 1`
  );
  const { rows: [done] } = await db.query(`select id from columns where board_id = 'seed-board-parth' and state_type = 'done'`);
  const { rows: [active] } = await db.query(`select id from columns where board_id = 'seed-board-parth' and state_type = 'active'`);
  const state = async () => (await db.query("select column_id, position, completed_at from tasks where id = $1", [victim.id])).rows[0];
  const commitCount = async () => Number((await db.query("select count(*) from commits")).rows[0].count);
  const move = { taskId: victim.id, columnId: done.id, afterTaskId: null };
  const before = JSON.stringify(await state());
  const commitsBefore = await commitCount();

  // Posting to a public page skips the middleware's cookie gate; product actions must
  // not run there. On product routes the gate redirects, and SA1b covers the action's
  // own session check for requests that get past the gate.
  const anonPublic = await callAction(ids.moveTaskAction, [move], { path: "/" });
  const anonProduct = await callAction(ids.moveTaskAction, [move]);
  record(
    "SA1",
    "Anonymous Server Action call is refused (public and product routes)",
    !anonPublic.ok && !anonProduct.ok && JSON.stringify(await state()) === before,
    `public ${anonPublic.status} ${anonPublic.error ?? anonPublic.text.slice(0, 20)}, product ${anonProduct.status}`
  );

  const forgedCookie = await callAction(ids.moveTaskAction, [move], { cookie: "better-auth.session_token=forged.forged" });
  record("SA1b", "Forged session cookie on a Server Action is refused", !forgedCookie.ok && JSON.stringify(await state()) === before, forgedCookie.error ?? `${forgedCookie.status}`);

  const idor = await callAction(ids.moveTaskAction, [move], { cookie: other });
  record("SA2", "User B moves User A's task through the raw action (IDOR)", !idor.ok && JSON.stringify(await state()) === before, idor.error ?? `${idor.status}`);

  const csrf = await callAction(ids.moveTaskAction, [move], { cookie: owner, origin: "https://evil.example" });
  record("SA3", "Cross-site Server Action call is refused (CSRF)", !csrf.ok && JSON.stringify(await state()) === before, `${csrf.status}`);

  const forgedCommit = await callAction(ids.createCommitAction, [{ message: "forged", projectId: null, weight: 2, userId: "demo-parth", source: "imported" }], { cookie: other });
  record("SA4", "Extra fields (userId, source) refused on commit", !forgedCommit.ok && (await commitCount()) === commitsBefore, forgedCommit.error ?? "");

  const pricey = await callAction(ids.createCommitAction, [{ message: "inflate", projectId: null, weight: 1_000_000 }], { cookie: other });
  record("SA5", "Inflated execution value refused", !pricey.ok && (await commitCount()) === commitsBefore, pricey.error ?? "");

  // Unpaid account: signs up fine, then every write is refused
  const email = uniqueEmail("unpaid");
  const { cookie: unpaid } = await verifiedSignUp(email);
  const free = await callAction(ids.createCommitAction, [{ message: "free ride", projectId: null, weight: 8 }], { cookie: unpaid });
  record("SA6", "Unpaid account cannot write through the raw action", !free.ok && (await commitCount()) === commitsBefore, free.error ?? `${free.status}`);

  // Development "Skip payment": its action id ships in the /subscribe bundle, so a
  // production build must refuse it on the server
  const subscribePage = await req("/subscribe", { headers: { cookie: unpaid } });
  let skipId = null;
  for (const m of subscribePage.text.matchAll(/<script[^>]+src="([^"]+\.js)"/g)) {
    const js = (await req(m[1])).text;
    skipId = js.match(/"([0-9a-f]{40,42})",[^"]{0,120}?"skipPaymentAction"/)?.[1] ?? skipId;
  }
  const skip = skipId ? await callAction(skipId, [{ plan: "organisation" }], { cookie: unpaid, path: "/subscribe" }) : null;
  const { rows: [granted] } = await db.query("select count(*)::int n from subscriptions s join users u on u.id = s.user_id where u.email = $1", [email]);
  const skipVisible = /Skip payment/.test(subscribePage.text);
  record(
    "SK1",
    "Skip payment is hidden and refused on a production build",
    Boolean(skip) && !skip.ok && /Payment is required/.test(skip.text) && granted.n === 0 && !skipVisible,
    skip ? `${skip.status} granted=${granted.n} visible=${skipVisible}` : "action id not found"
  );

  const legit = await callAction(ids.moveTaskAction, [{ taskId: victim.id, columnId: active.id, afterTaskId: null }], { cookie: owner });
  const after = await state();
  record("SA7", "Owner's own move succeeds and persists", legit.ok && after.column_id === active.id, legit.error ?? "");

  // Stored XSS: user text is rendered back to the same and other members
  const payload = `<img src=x onerror=alert(1)><script>alert(2)</script>`;
  const xssCapture = await callAction(ids.captureTaskAction, [{ text: payload }], { cookie: owner, path: "/platform/inbox" });
  const inboxHtml = (await req("/platform/inbox", { headers: { cookie: owner } })).text;
  record("X2", "Stored XSS in a captured task title is escaped", xssCapture.ok && !inboxHtml.includes("<img src=x onerror") && !inboxHtml.includes("<script>alert(2)"), xssCapture.error ?? "");

  // Organisations: created only by paid Organisation-plan accounts; owner and workspace come from the session
  const createOrgId = await actionIdOn("/platform/org", "createOrganisationAction", owner);
  const orgRows = async (slug) => (await db.query("select o.id, w.owner_id from organisations o join workspaces w on w.id = o.workspace_id where o.slug = $1", [slug])).rows;
  const unpaidOrg = createOrgId ? await callAction(createOrgId, [{ name: "Free Co", slug: "sa-free-co" }], { cookie: unpaid, path: "/platform/org" }) : null;
  record("OR1", "Unpaid account cannot create an organisation through the raw action", Boolean(unpaidOrg) && !unpaidOrg.ok && (await orgRows("sa-free-co")).length === 0, unpaidOrg ? unpaidOrg.error ?? `${unpaidOrg.status}` : "action id not found");
  const forgedOrg = createOrgId ? await callAction(createOrgId, [{ name: "Forged", slug: "sa-forged", ownerId: "demo-aarav" }], { cookie: owner, path: "/platform/org" }) : null;
  record("OR2", "Extra ownerId on organisation creation is refused", Boolean(forgedOrg) && !forgedOrg.ok && (await orgRows("sa-forged")).length === 0, forgedOrg?.error ?? "");
  const orgSlug = `sa-xss-${Date.now()}`;
  const xssOrg = createOrgId ? await callAction(createOrgId, [{ name: payload, slug: orgSlug }], { cookie: owner, path: "/platform/org" }) : null;
  const madeOrg = (await orgRows(orgSlug))[0];
  const orgHtml = (await req(`/platform/org/${orgSlug}`, { headers: { cookie: owner } })).text;
  record(
    "OR3",
    "Organisation is owned by the session user and its name is escaped",
    Boolean(xssOrg?.ok) && madeOrg?.owner_id === "demo-parth" && !orgHtml.includes("<img src=x onerror") && !orgHtml.includes("<script>alert(2)"),
    xssOrg?.error ?? `owner ${madeOrg?.owner_id}`
  );
  if (madeOrg) await db.query("delete from workspaces where id = (select workspace_id from organisations where id = $1)", [madeOrg.id]);

  // Invitations: single-use links from a fixed origin, accepted only by the invited address
  const junk = await Promise.all([`/invite/${"A".repeat(43)}`, "/invite/x'or'1=1", "/invite/%2e%2e%2fadmin"].map((p) => req(p)));
  record("IV1", "Unknown or malformed invitation links reveal nothing", junk.every((r) => r.status === 404 || (r.status === 200 && /Invitation expired/.test(r.text))), junk.map((r) => r.status).join(","));

  const membersPath = "/platform/org/ksan-relay/members";
  const inviteId = await actionIdOn(membersPath, "inviteMemberAction", owner);
  const newcomer = uniqueEmail("invitee");
  const { cookie: newcomerCookie } = await verifiedSignUp(newcomer);
  const inviteArgs = [{ organisationId: "seed-org-ksan", email: newcomer, role: "member" }];
  // A forwarded Host that disagrees with Origin fails Next's action check; the link itself always uses the configured origin
  const poisoned = inviteId ? await callAction(inviteId, inviteArgs, { cookie: owner, path: membersPath, extraHeaders: { "x-forwarded-host": "evil.example" } }) : null;
  const poisonedMail = await nextEmail(newcomer, /Join .* on State/);
  const invite = inviteId ? await callAction(inviteId, inviteArgs, { cookie: owner, path: membersPath }) : null;
  const inviteLink = linkIn(await nextEmail(newcomer, /Join .* on State/));
  record(
    "IV2",
    "Invitation link uses the fixed origin; a forged forwarded Host sends nothing",
    Boolean(poisoned) && !poisoned.ok && !poisonedMail && Boolean(invite?.ok) && Boolean(inviteLink) && new URL(inviteLink).origin === ORIGIN,
    invite?.error ?? `poisoned ${poisoned?.status}, link ${inviteLink}`
  );

  const token = inviteLink ? new URL(inviteLink).pathname.split("/").pop() : "";
  const invitePath = `/invite/${token}`;
  const acceptId = inviteLink ? await actionIdOn(invitePath, "acceptInvitationAction", newcomerCookie) : null;
  const memberRow = async () => (await db.query("select m.role from organisation_members m join users u on u.id = m.user_id where m.organisation_id = 'seed-org-ksan' and u.email = $1", [newcomer])).rows[0] ?? null;
  const anonAccept = acceptId ? await callAction(acceptId, [{ token }], { path: invitePath }) : null;
  const wrongAccept = acceptId ? await callAction(acceptId, [{ token }], { cookie: other, path: invitePath }) : null;
  const aaravRole = (await db.query("select role from organisation_members where organisation_id = 'seed-org-ksan' and user_id = 'demo-aarav'")).rows[0]?.role;
  record(
    "IV3",
    "Invitation cannot be accepted anonymously or by another account",
    Boolean(acceptId) && !anonAccept.ok && !wrongAccept.ok && (await memberRow()) === null && aaravRole === "admin",
    acceptId ? `anon ${anonAccept.error ?? anonAccept.status}, other ${wrongAccept.error ?? wrongAccept.status}` : "action id not found"
  );
  const accepted = acceptId ? await callAction(acceptId, [{ token }], { cookie: newcomerCookie, path: invitePath }) : null;
  const replayed = acceptId ? await callAction(acceptId, [{ token }], { cookie: newcomerCookie, path: invitePath }) : null;
  record("IV4", "Invited address joins once; the link cannot be replayed", Boolean(accepted?.ok) && (await memberRow())?.role === "member" && !replayed?.ok, accepted?.error ?? replayed?.error ?? "");

  const spamTarget = uniqueEmail("spam");
  const spam = [];
  for (let i = 0; i < 4; i++) spam.push(inviteId ? await callAction(inviteId, [{ organisationId: "seed-org-ksan", email: spamTarget, role: "viewer" }], { cookie: owner, path: membersPath }) : null);
  record("IV5", "Invitations to one address are capped (mail bombing)", spam.slice(0, 3).every((r) => r?.ok) && /Too many invitations/.test(spam[3]?.error ?? ""), spam.map((r) => r?.error ?? (r?.ok ? "ok" : "?")).join(" | "));
  await db.query("delete from organisation_members where organisation_id = 'seed-org-ksan' and user_id = (select id from users where email = $1)", [newcomer]);
  await db.query("delete from organisation_invitations where email = $1", [spamTarget]);

  // Recurring tasks: the repeat rule is the owner's to set and comes from a fixed list
  const taskPath = `/platform/personal?task=${victim.id}`;
  const repeatId = await actionIdOn(taskPath, "setTaskRecurrenceAction", owner);
  const ruleOf = async () => (await db.query("select recurrence_rule from tasks where id = $1", [victim.id])).rows[0].recurrence_rule;
  const repeatIdor = repeatId ? await callAction(repeatId, [{ taskId: victim.id, rule: "daily" }], { cookie: other, path: taskPath }) : null;
  const repeatBad = repeatId ? await callAction(repeatId, [{ taskId: victim.id, rule: "interval:0" }], { cookie: owner, path: taskPath }) : null;
  const repeatForged = repeatId ? await callAction(repeatId, [{ taskId: victim.id, rule: "weekly", recurrenceParentId: "x" }], { cookie: owner, path: taskPath }) : null;
  record(
    "RT1",
    "Repeat rule: another user's call, invalid rules and extra fields are refused",
    Boolean(repeatId) && !repeatIdor.ok && !repeatBad.ok && !repeatForged.ok && (await ruleOf()) === null,
    repeatId ? `${repeatIdor.error} | ${repeatBad.error} | ${repeatForged.error}` : "action id not found"
  );

  // Write budget: 60 per user per minute, shared across instances. Invalid calls count too.
  const burst = await Promise.all(Array.from({ length: 70 }, () => callAction(ids.moveTaskAction, [{}], { cookie: other })));
  const limited = burst.filter((r) => /Too many changes/.test(r.error ?? "")).length;
  record("SA8", "Write burst is rate limited per user", limited >= 10, `${limited} of 70 limited`);
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
  const owner = await signIn("demo@state.test");

  // Client bundles: no secrets, no server-only modules (client/server boundary)
  const chunks = new Set();
  for (const path of ["/", "/login", "/pricing", "/platform/today", "/platform/personal", "/platform/inbox", "/platform/settings/billing"]) {
    const page = await req(path, { headers: owner ? { cookie: owner } : {} });
    for (const m of page.text.matchAll(/<script[^>]+src="([^"]+\.js)"/g)) chunks.add(m[1]);
  }
  const leaks = [];
  const patterns = [
    [/postgres(ql)?:\/\/[^"'\s]+/, "database URL"],
    [/sk_(live|test)_[0-9A-Za-z]{10,}/, "Stripe secret key"],
    [/drizzle-orm|pg-pool|@neondatabase|better-auth\/adapters/, "server-only module"],
  ];
  // The real secret values this deployment was configured with (names alone are harmless:
  // auth libraries reference them and read undefined in the browser)
  const secretValues = Object.entries(readEnvFile())
    .filter(([k, v]) => !k.startsWith("NEXT_PUBLIC_") && /SECRET|KEY|PASSWORD|TOKEN|DATABASE_URL/.test(k) && v.length >= 8)
    .map(([k, v]) => [k, v]);
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

  // CORS: the API never reflects a foreign Origin with credentials
  const cors = [];
  for (const path of ["/api/health", "/api/auth/get-session", "/api/billing/checkout"]) {
    const res = await req(path, { method: "OPTIONS", headers: { origin: "https://evil.example", "access-control-request-method": "POST" } });
    const acao = res.headers.get("access-control-allow-origin");
    if (acao === "*" && res.headers.get("access-control-allow-credentials") === "true") cors.push(`${path} wildcard+credentials`);
    if (acao === "https://evil.example") cors.push(`${path} reflects origin`);
  }
  record("CO1", "CORS does not trust foreign origins", cors.length === 0, cors.join("; "));

  // Authenticated pages must not be stored by shared caches (cache deception)
  if (owner) {
    const today = await req("/platform/today", { headers: { cookie: owner } });
    const cc = today.headers.get("cache-control") || "";
    record("CA1", "Authenticated pages are private, no-store", /no-store/.test(cc) && !/public/.test(cc), cc);
    const deception = await req("/platform/today/style.css", { headers: { cookie: owner } });
    record("CA2", "Static-looking suffix on a private page is not served as a cacheable asset", deception.status !== 200 || /no-store/.test(deception.headers.get("cache-control") || ""), `${deception.status}`);
  }

  // Better Auth endpoints that would let a user rewrite privileged fields or the account
  if (owner && db) {
    const snap = async () =>
      JSON.stringify((await db.query("select id, email, email_verified, subscription_status, subscription_plan from users where id = 'demo-parth'")).rows[0]);
    await db.query("update users set subscription_status = 'none', subscription_plan = null where id = 'demo-parth'");
    const before = await snap();
    const res = await req("/api/auth/update-user", {
      method: "POST",
      body: { name: "Parth", subscriptionStatus: "active", subscriptionPlan: "organisation", emailVerified: true, id: "demo-aarav", email: "x@example.test" },
      headers: { cookie: owner, origin: ORIGIN },
    });
    const after = await snap();
    record("M2", "update-user ignores privileged fields (mass assignment)", before === after, `${res.status} ${after}`);
  }
  // Sign-out must kill the session server-side, not just clear the cookie
  const temp = await signIn("ishita@state.test");
  if (temp) {
    await req("/api/auth/sign-out", { method: "POST", body: {}, headers: { cookie: temp, origin: ORIGIN } });
    const reuse = await req("/platform/today", { headers: { cookie: temp } });
    record("K2", "Session token is invalid after sign-out (replay)", [303, 307, 308].includes(reuse.status) && /\/login/.test(reuse.headers.get("location") || ""), `${reuse.status}`);
  }

  const hidden = [];
  for (const path of ["/api/auth/delete-user", "/api/auth/change-email", "/api/auth/admin/list-users", "/api/auth/admin/set-role", "/api/admin", "/api/debug", "/graphql", "/api/graphql", "/swagger", "/openapi.json", "/.env", "/.git/config"]) {
    const res = await req(path, { method: path.startsWith("/api/auth") ? "POST" : "GET", body: path.startsWith("/api/auth") ? {} : undefined, headers: { origin: ORIGIN, ...(owner ? { cookie: owner } : {}) } });
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
  await checkWebhooks();
  await checkAuth();
  await checkEmailFlows();
  await checkServerActions();
  await checkSurface();
  if (db) await db.end();

  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id.padEnd(3)} ${r.name}${r.detail && (!r.pass || process.env.VERBOSE) ? `  — ${r.detail}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});

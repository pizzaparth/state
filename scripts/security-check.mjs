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
  const good = ["/today", "/projects/relaydb?tab=metrics", "/subscribe?plan=organisation"];
  const leaked = evil.filter((p) => isSafeRedirectPath(p));
  const blocked = good.filter((p) => !isSafeRedirectPath(p));
  record("R1", "Login ?next= rejects off-site targets", leaked.length === 0, leaked.join(" | "));
  record("R2", "Login ?next= keeps same-site paths", blocked.length === 0, blocked.join(" | "));
}

// ---------------------------------------------------------------- access control
async function checkAccessControl() {
  const anon = await req("/today");
  record("A1", "Product route without session redirects to sign-in", anon.status === 307 && /\/login/.test(anon.headers.get("location") || ""), `${anon.status}`);

  const forged = await req("/today", { headers: { cookie: "better-auth.session_token=forged.forged" } });
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

  // Session cookie flags
  const cookie = (signUp.headers.getSetCookie?.() ?? []).find((c) => c.includes("session_token")) || "";
  const flags = [!/HttpOnly/i.test(cookie) && "HttpOnly", !/SameSite=(Lax|Strict)/i.test(cookie) && "SameSite", !/Path=\//i.test(cookie) && "Path"].filter(Boolean);
  record("K1", "Session cookie is HttpOnly + SameSite", cookie !== "" && flags.length === 0, cookie ? `missing ${flags.join(", ")}` : "no cookie set");

  // Paywall: an authenticated but unpaid user cannot reach the product
  const session = sessionCookie(signUp);
  if (session) {
    const today = await req("/today", { headers: { cookie: session } });
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

async function main() {
  if (db) await db.connect();
  await checkHeaders();
  await checkReflectedXss();
  checkOpenRedirect();
  await checkAccessControl();
  await checkWebhooks();
  await checkAuth();
  if (db) await db.end();

  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id.padEnd(3)} ${r.name}${r.detail && !r.pass ? `  — ${r.detail}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});

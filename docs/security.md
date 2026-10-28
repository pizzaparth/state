# Security testing and hardening

Scope: public marketing pages, authentication (`/login`, `/register`, `/api/auth/*`),
the paywall (`/subscribe`, product routes) and billing endpoints
(`/api/billing/*`, `/api/webhooks/*`). Last run: 28 October 2026.

No test suite makes an application “hack-proof”. This one covers the known exploit
classes for these surfaces and keeps them from regressing. Get a human penetration
test before launch, and re-run the suite on every change to auth, billing or middleware.

## How to run

```bash
createdb state_security_test
DATABASE_URL=postgresql://$USER@localhost:5432/state_security_test npm run db:migrate

NEXT_DIST_DIR=.next-verify npm run build
NEXT_DIST_DIR=.next-verify DATABASE_URL=postgresql://$USER@localhost:5432/state_security_test \
  BETTER_AUTH_URL=http://localhost:3123 NEXT_PUBLIC_APP_URL=http://localhost:3123 \
  npx next start -p 3123

BASE_URL=http://localhost:3123 DATABASE_URL=postgresql://$USER@localhost:5432/state_security_test \
  npm run security:check
BASE_URL=http://localhost:3123 npm run bench
```

Never run the suite against production: it creates accounts and triggers rate limits.
`NEXT_DIST_DIR` keeps the build away from a running `next dev`. The build rewrites
`next-env.d.ts` and `tsconfig.json` to point at it, so restore those before committing.

## Results

Baseline (before hardening): 22 of 31 checks passed. After hardening: 38 of 38.

| Check | Exploit class | Before | After |
|---|---|---|---|
| H1 | Missing CSP, clickjacking, MIME sniffing, HSTS and referrer headers | Fail (all pages) | Pass: nonce CSP with `strict-dynamic`, `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP |
| R1 | Open redirect through `?next=` (`/\evil`, `/%2F%2Fevil`, tab-smuggled `/\t/evil`) | Fail | Pass: resolved against a probe origin; backslashes, control characters and encoded slashes rejected |
| M0/K1 | Sign-up blocked by the in-memory limiter shared across tests (limits were per instance, so ineffective on serverless) | Fail | Pass: limits stored in Postgres |
| B1 | Brute force from one IP | Pass | Pass: 5 sign-ins per minute per IP |
| B2 | Credential stuffing with rotating IPs | Not tested | Pass: 10 attempts per account per 15 minutes, keyed by email |
| X1 | Reflected XSS through query parameters | Pass | Pass |
| C1–C3 | CSRF on sign-in, sign-up and checkout | Pass on auth; checkout untested | Pass: same-origin check on billing endpoints |
| S1/S2 | SQL and operator injection | Pass | Pass |
| M1 | Mass assignment of `subscriptionStatus`, `emailVerified`, `id` at sign-up | Pass | Pass |
| A1–A6 | Product access without a session, with a forged cookie, or unpaid | Pass | Pass |
| V1–V4 | Tampered plan or seats, oversized body, forged payment confirmation, subscription without payment | Not tested | Pass: 16 KB body cap, generic provider errors |
| W1–W3 | Forged Razorpay and Stripe webhooks | Pass | Pass |
| P1/P2 | Weak password; 10 000-character password (hashing DoS) | Pass | Pass: 8–128 characters |
| I1 | Stack trace leakage | Pass | Pass |

## Dependency audit (`npm audit --omit=dev`)

- **zod < 4.6.6 (high, GHSA-mrhx-c7xc-m3w5):** memory exhaustion on oversized collections. Fixed by upgrading to 4.6.7.
- **postcss inside next (high):** build-time only. It processes the project's own CSS, never user input. The fix needs Next 16; take it with that upgrade.
- **esbuild inside drizzle-kit (moderate):** affects esbuild's dev server, which drizzle-kit never starts. Dev-only CLI.

## Benchmark (local production build, 400 requests per route, concurrency 20)

| Route | req/s | p50 ms | p95 ms | p99 ms | 5xx |
|---|---|---|---|---|---|
| `/` | 374 | 50.0 | 84.0 | 85.5 | 0 |
| `/pricing` | 791 | 25.2 | 29.4 | 30.2 | 0 |
| `/login` | 1110 | 17.9 | 19.5 | 19.8 | 0 |
| `/register` | 1097 | 18.2 | 20.2 | 20.3 | 0 |
| `/legal/privacy` | 657 | 29.6 | 45.4 | 45.9 | 0 |
| `/api/health` | 5699 | 2.9 | 5.8 | 6.8 | 0 |

Every page now renders per request so it can carry a fresh CSP nonce. The landing page
is the slowest route because it server-renders the 371-day sample graph.

## Known residual risks

- **Account enumeration at sign-up.** An already-registered email gets
  `USER_ALREADY_EXISTS`. Better Auth hides this once `requireEmailVerification` is on,
  which needs an email provider. Until then, the limit of 5 sign-ups per hour per IP
  slows enumeration.
- **No email verification or 2FA yet.** Both are planned in the spec.
- **IP trust.** Per-IP limits read `x-forwarded-for`, which Vercel overwrites at the
  edge. On any other host, set `advanced.ipAddress.trustedProxies`.
- **Targeted lockout.** The per-account throttle lets anyone delay one person's
  sign-ins for up to 15 minutes. That is the accepted cost of stopping credential
  stuffing.
- **`style-src 'unsafe-inline'`** stays, because React style attributes and next/font
  need it. Scripts are nonce-only.
- **Volumetric DDoS** is left to the hosting edge (Vercel). The app does not mitigate it.

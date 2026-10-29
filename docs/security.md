# Security testing and hardening

Scope: the whole application. That covers the public pages, authentication (`/login`,
`/register`, email verification, password reset, `/api/auth/*`), the paywall and billing (`/subscribe`, `/api/billing/*`,
`/api/webhooks/*`), the product pages and the product's Server Actions (board moves,
Inbox capture, manual commits). Last run: 29 October 2026, against
[docs/checklist.md](checklist.md).

No test suite makes an application “hack-proof”. These suites cover the exploit classes
in the checklist and keep them from regressing. Get a human penetration test before
launch. Re-run both suites on every change to auth, billing, middleware, queries or
mutations. CI (`.github/workflows/ci.yml`) runs them on every push.

## How to run

```bash
createdb state_security_test
export DATABASE_URL=postgresql://$USER@localhost:5432/state_security_test
npm run db:migrate
npx tsx scripts/seed.ts            # demo tenants; refuses non-local databases

npm run authz:check                # BOLA/IDOR suite against the real query and mutation code

NEXT_DIST_DIR=.next-verify npm run build
export EMAIL_OUTBOX_DIR=.email-outbox   # emails as JSON, so the suite can follow links
NEXT_DIST_DIR=.next-verify BETTER_AUTH_URL=http://localhost:3123 NEXT_PUBLIC_APP_URL=http://localhost:3123 \
  npx next start -p 3123 &
BASE_URL=http://localhost:3123 npm run security:check      # VERBOSE=1 prints every detail
BASE_URL=http://localhost:3123 BENCH_EMAIL=aarav@state.test BENCH_PASSWORD=state-demo-2026 npm run bench
```

Never run any of these against production: they create accounts, change roles and trigger
rate limits. `authz:check` refuses any database whose name does not end in `_test`.
`NEXT_DIST_DIR` keeps the build away from a running `next dev`. The build rewrites
`next-env.d.ts` and `tsconfig.json`, so restore both before committing.

## Authorization model

| Layer | Rule |
|---|---|
| Identity | Comes only from the Better Auth session (`getSession`). No request body or query carries a user id that is trusted. |
| Reads | `getViewer()` lists the viewer's workspaces: their personal workspace plus their organisation memberships. Every query in `db/queries` filters by those ids. A foreign id returns nothing, so the page 404s or shows no panel. |
| Writes | Server Actions (`app/(app)/actions.ts`) check the session, paid access, a per-user write budget (60 a minute, in Postgres) and a strict Zod schema. Unknown keys are rejected. The actions then call `lib/mutations.ts`. |
| Object checks | `lib/mutations.ts` loads each referenced object (task, column, neighbour card, project) and checks it with `assertWritable` against workspaces re-read from the database on every call. The column must belong to the task's own board. A neighbour card from another board is ignored. |
| Roles | Personal workspace: owner only. Organisation: owner, admin and member write; viewer reads only and gets “view-only access”. Removing a member takes effect on their next request. |
| Server-derived fields | Workspace, author, timestamps, commit source and execution value are never taken from the request. A commit's value is the task weight (1/2/4/8). |
| Integrity | Moving a card to Done locks the task row and inserts its commit under a unique index (one live commit per task). Leaving Done retires that commit and writes an audit event. |

## Results

`npm run authz:check`: **32 of 32 pass.**

| Group | Checks |
|---|---|
| R1–R9 reads | Another user's task, commit and board by id. An outsider reading the organisation board and its tasks. Projects, commit ledger and Inbox leak no foreign rows. A member can read organisation tasks. |
| W1–W11 writes | Move another user's task. An outsider moves an organisation task. Move into a column on someone else's board, or across workspaces. A foreign `afterTaskId` is ignored. Viewer-role moves and commits. A commit into another user's project. A commit lands in the right workspace with the session user as author. A capture with a foreign `#project` stays in the user's own Inbox. A mis-built actor still cannot write outside its writable set. |
| M1–M6 tampering | Extra `workspaceId`/`userId`/`source`/`createdAt` keys rejected. Commit weight outside 1/2/4/8 rejected (0, negative, 1 000 000, string, fraction). Oversized message and capture rejected. Ids with SQL metacharacters rejected. |
| L1–L6 lifecycle and races | 10 parallel Done moves record exactly one commit. A replayed Done records nothing. Reopen retires the commit, and completing again records one. A deleted task cannot be moved. A removed member loses write access at once. |

`npm run security:check` (black box, production build): **77 of 77 pass.**

Email verification and password reset (EV, PR):

| Check | Exploit class | Result |
|---|---|---|
| EV1/EV2 | Session before verification; signing in unverified | No session cookie; sign-in returns 403 `EMAIL_NOT_VERIFIED` |
| EV3 | Forged verification token | Redirected with `error=INVALID_TOKEN`, no session |
| EV4 | Replaying a verification link | First use signs in; a replay opens no session |
| EV5, PR2 | Links built from a forged `Host` / `X-Forwarded-Host` (reset poisoning) | Links always use `BETTER_AUTH_URL` |
| EV6, PR1 | Account enumeration through sign-up or reset | Registered and new addresses get byte-identical answers; the owner gets a notice email |
| PR3 | Reset `redirectTo` to another origin | 403 |
| PR4 | Mail-bombing one address from rotating IPs | 3 per address per hour, then 429 |
| PR5–PR7 | Weak new password; token reuse | 400; the token works once |
| PR8 | Sessions surviving a reset (attacker keeps a stolen session) | Every session revoked |
| PR9–PR11 | Old password after reset; expired token; guessed token | Refused |
| PR12 | HTML injection through the name in emails | Escaped |

Product and surface checks:

| Check | Exploit class | Result |
|---|---|---|
| SA0 | Server Action ids pulled from client chunks, as an attacker would | Found all three |
| SA1/SA1b | Anonymous call on public and product routes; forged session cookie | Refused, no change |
| SA2 | User B replays the raw move action on User A's task (IDOR) | “That item no longer exists.”, no change |
| SA3 | Cross-site call with the victim's cookie (CSRF) | Refused by Next's Origin/Host check |
| SA4/SA5 | Extra fields; inflated execution value | Rejected, no commit written |
| SA6 | Unpaid account writing through the raw action | “Your subscription is not active.” |
| SA7 | The owner's own move | Saved |
| SK1 | Calling the development “Skip payment” action on a production build | Hidden and refused on the server; no subscription created |
| SA8 | Burst of 70 writes | Write budget blocks the excess |
| X2 | Stored XSS in a task title | Escaped on render |
| K2 | Session token reused after sign-out | Redirected to sign-in |
| F1/F2 | Secrets, real `.env` values or server modules in 25 client chunks; served source maps | None |
| CO1 | CORS reflecting a foreign origin | No |
| CA1/CA2 | Authenticated pages cached; cache deception through `/today/style.css` | `private, no-store`; 404 |
| M2 | Better Auth `update-user` with `subscriptionStatus`, `emailVerified`, `id`, `email` | Rejected, no field changed |
| E1/E2 | Admin, debug, GraphQL, Swagger, `.env` and `.git` paths; health check disclosure | None answer; no versions |

Manual checks: a production server refuses to start with the example secret, a short
secret or a non-https public URL (`instrumentation.ts`, `lib/env.ts`). Repeated or
malformed `?task=`/`?commit=` parameters never reach a query. Tried with
`?task=a&task=b`, `task[]`, `%00`, `range` and `period`.

## Checklist coverage (docs/checklist.md)

| § | Area | Status |
|---|---|---|
| 1 | Release gate | No blocker found. Each item below is tested or not applicable. |
| 2 | Authentication | Server-side session on every page, action and route. Login, sign-up, reset and per-account limits (B1, B2, PR4). Email verification is required before any session (EV1–EV4). Reset tokens are random, single-use and expire after one hour (PR7, PR10, PR11), with links from a fixed origin (PR2). Default credentials exist only in local seeds, and the seed refuses remote databases. There is no OTP or MFA yet. |
| 3–4 | Authorization, IDOR/BOLA | authz R/W/L groups and SA1–SA7. Cross-workspace and cross-organisation access tested for reads, updates and ownership (author is server-derived). There is no delete endpoint yet. |
| 5 | Database | Postgres is reached only from the server. All queries are parameterised by Drizzle. No service key reaches the browser (F1). The app is not on Supabase or Firebase, so RLS does not apply; tenant scoping is enforced in the query layer and tested. |
| 6 | Secrets | `.env` was never committed (history scanned). Known key patterns and the real `.env` values appear in no tracked file, no history and no client chunk. |
| 7–8 | SQL and command injection | Drizzle parameters only; the raw `sql` fragments interpolate bound values. Strict id regex (M6, S1, S2). No shell execution anywhere. |
| 9 | XSS | React escaping; no `dangerouslySetInnerHTML` on user data. Nonce CSP with `strict-dynamic` (H1, X1, X2). |
| 10 | CSRF | Better Auth Origin checks (C1, C2), billing Origin guard (C3), Server Action Origin/Host check (SA3), SameSite cookies (K1). |
| 11–13 | Sessions, JWT, OAuth | Opaque random session tokens, server-side revocation (K2), every session revoked on password reset (PR8), 14-day expiry. The reset token is removed from the address bar and history when the page loads. No JWTs. OAuth uses Better Auth's state and PKCE; account linking is pinned to verified emails, no trusted providers and no cross-email linking. |
| 14–15 | API, mass assignment | Endpoints enumerated (E1); strict schemas (M1–M5, SA4, M2); bounded payloads (64 KB Server Actions, 16 KB billing JSON, list limits). |
| 16–18 | SSRF, uploads, path traversal | Not applicable: the server fetches no user URLs, takes no uploads and serves no files by path. |
| 19–22 | Webhooks, payments, business logic, races | Signed webhooks (W1–W3); price and plan resolved on the server (V1–V4). The development payment skip is off in production builds and refused on the server (SK1); `lib/env.ts` blocks the override flag on public URLs. Workflow skipping, replay and parallel completion covered (L1–L4, SA6). |
| 23–31 | CORS, headers, clickjacking, redirects, reset poisoning, Host header, cache | CO1, H1, R1, PR2, PR3. Auth, email and payment URLs come from fixed env values (`baseURL`, `lib/env.ts`), never the Host header. No shared caching of private pages (CA1, CA2). |
| 32–36 | Prototype pollution, DOM clobbering, postMessage, WebSockets, GraphQL | Strict Zod objects, no `message` listeners, no WebSocket or GraphQL endpoints. |
| 37 | Email change | Not offered: Better Auth's change-email endpoint is disabled (E1). |
| 38–39 | Rate limits, DoS | Auth (B1, B2), writes (SA8), body caps, bounded queries, indexed foreign keys. Volumetric DDoS is left to the edge. |
| 40–44 | Frontend leaks, source maps, hidden routes, git, errors | F1, F2, E1, I1. Actions return generic errors; details are logged on the server only. |
| 45–46 | Supply chain, CI | `npm audit`: 0 vulnerabilities (overrides patch postcss in Next and esbuild in drizzle-kit). Lockfile committed. CI token is `contents: read`, checkout drops credentials, and installs skip scripts. |
| 47–52 | Deployment, DNS, storage, third-party scripts, CSP | Only Razorpay Checkout loads, nonce-gated. No cloud storage. DNS and subdomains are for the deployer to inventory at launch. |
| 53–58 | Unicode, TOCTOU, HPP, parsing, XS-Leaks, service workers | Row locks on moves, HPP probes, `Cross-Origin-Resource-Policy: same-origin`, COOP. No service worker. |
| 59–60 | Client/server boundary, vibe-coding review | F1 finds no server modules in the client bundle. No auth bypasses, client-side role checks or client prices. |
| 61–62, 66 | Tooling, multi-user test | Covered by `authz:check` and `security:check` with anonymous, user A, user B, outsider, viewer, unpaid and paid users. There is no admin role. Semgrep, gitleaks, OSV and ZAP are not installed here; run them in CI or before launch. |

## Scalability

Load test: 5,000 extra tenants with 300,000 tasks and 600,000 commits, in the same
database as the demo data.

| Route (signed in, 400 requests, concurrency 20) | p50 ms | p95 ms | p50 with 900k extra rows | p95 with 900k extra rows |
|---|---|---|---|---|
| `/today` | 83.8 | 100.4 | 84.2 | 100.4 |
| `/personal` (board) | 57.4 | 84.2 | 56.7 | 59.1 |
| `/org/ksan-relay` | 105.0 | 132.6 | 105.7 | 135.9 |
| `/metrics` | 95.5 | 109.5 | 97.5 | 118.0 |
| `/activity` | 75.9 | 133.9 | 76.3 | 121.2 |
| Write (capture action round trip) | 9.1 | 13.0 | 12.2 | 22.4 |

Latency depends on the size of one tenant's data, not on the size of the table. Every hot
query uses an index at 900k rows: daily execution 8.8 ms, board 0.5 ms, Inbox, next card
in column, project aggregates and paid access each under 0.1 ms.

What keeps it flat:

- Every query is scoped to the viewer's workspaces. Project aggregates were scanning all
  tenants and are now scoped.
- Every foreign key is indexed. Deleting those 5,000 tenants took 15.5 s; before the
  indexes it was aborted after more than 5 minutes.
- `tasks_board_column_idx` uses the C collation, matching the fractional position keys.
  Moving a card rewrites only that card.
- Payloads are bounded: 1,000 cards per board, 200 Inbox items, 500 open tasks. The shell
  counts the Inbox without loading it.
- Each instance has a small pool (`DATABASE_POOL_MAX`, default 10). In production, use
  Neon's pooled host so many serverless instances share few Postgres connections.
- Rate-limit tables are pruned, so attacker-chosen keys cannot grow them without bound.
- One stateless Next.js app: instances scale horizontally, and all shared state (sessions,
  limits) is in Postgres.

## Dependency audit

`npm audit`: **0 vulnerabilities.** `package.json` `overrides` pin postcss inside
Next to the patched release (GHSA-qx2v-qp2m-jg93 and related) and esbuild inside
drizzle-kit (GHSA-67mh-4wv8-2f99). Builds, migrations and `drizzle-kit generate` were
verified after the overrides.

## Known residual risks

- **No 2FA yet.** It is planned in the spec. Organisation invitations have no acceptance
  flow yet; when they do, accepting must require a verified email that matches the invite.
- **Unverified sign-in.** With the correct password, an unverified account answers
  `EMAIL_NOT_VERIFIED`. This needs the password, so it reveals nothing to someone who only
  has the email.
- **Email delivery.** Production refuses to start without `RESEND_API_KEY` and
  `EMAIL_FROM`. Set SPF, DKIM and DMARC on the sending domain so links are not spoofed or
  sent to spam.
- **IP trust.** Per-IP limits read `x-forwarded-for`, which Vercel overwrites. On any
  other host, set `advanced.ipAddress.trustedProxies`.
- **Targeted lockout.** The per-account sign-in throttle lets anyone delay one person's
  sign-ins for up to 15 minutes.
- **`style-src 'unsafe-inline'`** remains for React style attributes and next/font.
  Scripts are nonce-only.
- **Volumetric DDoS** is left to the hosting edge.
- **Not run here:** Semgrep, gitleaks, OSV-Scanner, Trivy, OWASP ZAP and a human
  penetration test. Run them against staging before launch.

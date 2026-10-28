# Pre-Ship Security Checklist for Vibe-Coded Websites

Use this document as a **security gate before shipping** any AI-generated, vibe-coded, or rapidly assembled web application.

Assume generated code is **functionally useful but security-untrusted** until reviewed.

A strong baseline is:

- OWASP ASVS
- OWASP Web Security Testing Guide
- OWASP Top 10
- OWASP API Security Top 10

---

# 1. Release Gate

Do **not ship** if any of these exist:

- Authentication bypass
- Broken authorization
- IDOR / BOLA
- Admin privilege escalation
- SQL injection
- Command injection
- Exposed database
- Exposed production secrets
- Leaked service-role keys
- Insecure password reset
- Stored XSS affecting authenticated users
- SSRF into internal infrastructure
- Private user data exposure
- Payment manipulation
- Unverified webhooks
- Public cloud-storage buckets containing private data
- Ability for one user to access another user's resources

---

# 2. Authentication

Check:

- [ ] Login cannot be bypassed.
- [ ] Every authenticated API endpoint verifies authentication server-side.
- [ ] Backend never trusts frontend-provided identity.
- [ ] `userId` comes from the authenticated session.
- [ ] `email` is not treated as proof of identity unless verified.
- [ ] `role` is not trusted from request JSON.
- [ ] `isAdmin` is never trusted from frontend state.
- [ ] OAuth callback URLs are strictly controlled.
- [ ] OAuth `state` is validated.
- [ ] PKCE is used where appropriate.
- [ ] Password reset tokens are cryptographically random.
- [ ] Password reset tokens expire.
- [ ] Password reset tokens are single-use.
- [ ] Password-reset links use trusted host configuration.
- [ ] Email verification cannot be bypassed.
- [ ] MFA cannot be skipped by directly calling later endpoints.
- [ ] No default admin/test credentials remain.
- [ ] Login endpoints are rate-limited.
- [ ] Password reset endpoints are rate-limited.
- [ ] OTP endpoints are rate-limited.
- [ ] Sensitive actions require reauthentication where appropriate.
- [ ] Account enumeration is minimized.

---

# 3. Authorization

This is one of the highest-priority areas.

Create at least:

- Anonymous user
- User A
- User B
- Paid user
- Admin

For every endpoint ask:

- [ ] Can anonymous users call it?
- [ ] Can User A access User B's resource?
- [ ] Can User A modify User B's resource?
- [ ] Can a free user access paid functionality?
- [ ] Can a normal user call admin endpoints?
- [ ] Can hidden API calls bypass frontend restrictions?
- [ ] Can ownership be changed?
- [ ] Can organization/workspace IDs be substituted?
- [ ] Can UUIDs be changed to access another user's object?

Test routes such as:

```text
/api/tasks/123
/users/123
/projects/123
/workspaces/123
/files/123
/orders/123
/subscriptions/123
```

Never rely on unguessable UUIDs as an authorization mechanism.

Server-side authorization must verify:

```text
authenticated_user owns resource
OR
authenticated_user has explicit permission
```

Hiding buttons in React is **not authorization**.

---

# 4. IDOR / BOLA

Test direct object access by modifying:

- Numeric IDs
- UUIDs
- User IDs
- Workspace IDs
- Project IDs
- File IDs
- Organization IDs
- Invoice IDs
- Subscription IDs
- Order IDs
- Query parameters
- JSON body IDs

Examples:

```text
GET /api/files/USER_A_FILE
GET /api/files/USER_B_FILE

PATCH /api/projects/PROJECT_B
DELETE /api/tasks/USER_B_TASK
```

Check:

- [ ] Read protection
- [ ] Update protection
- [ ] Delete protection
- [ ] Ownership transfer protection
- [ ] Admin-only objects
- [ ] Cross-workspace access
- [ ] Cross-organization access

---

# 5. Database Security

Check:

- [ ] Database is not unnecessarily exposed to the public Internet.
- [ ] Production database credentials are private.
- [ ] No admin/service-role key exists in frontend code.
- [ ] No database password is committed.
- [ ] No backup contains plaintext credentials.
- [ ] Database backups are private.
- [ ] User-supplied values are parameterized.

If using Supabase:

- [ ] RLS enabled for every user-facing table.
- [ ] Newly created tables have RLS.
- [ ] `service_role` key never reaches browser code.
- [ ] Users can only access rows they own.
- [ ] Users cannot change `owner_id`.
- [ ] Users cannot change `role`.
- [ ] Users cannot change subscription/payment fields.
- [ ] Users cannot modify another user's records.

If using Firebase:

- [ ] Firestore rules do not allow broad reads/writes.
- [ ] Storage rules protect private files.
- [ ] Rules verify authenticated user identity.
- [ ] Client-side fields do not determine authorization.

---

# 6. Secret Management

Search the entire repository and Git history for:

```text
API_KEY
SECRET
TOKEN
PASSWORD
PRIVATE_KEY
DATABASE_URL
JWT_SECRET
STRIPE_SECRET
WEBHOOK_SECRET
SMTP_PASSWORD
AWS_SECRET_ACCESS_KEY
SUPABASE_SERVICE_ROLE
GOOGLE_CLIENT_SECRET
GITHUB_TOKEN
```

Check:

- [ ] `.env` files are not committed.
- [ ] `.env.production` is not committed.
- [ ] Secrets are not embedded in frontend bundles.
- [ ] Secrets are not included in source maps.
- [ ] Secrets are not present in CI logs.
- [ ] Secrets are not present in deployment logs.
- [ ] Secrets are not printed during debugging.
- [ ] Git history has been scanned.
- [ ] Exposed secrets have been rotated.

Remember:

```text
NEXT_PUBLIC_*
VITE_*
PUBLIC_*
```

are generally visible to users.

Anything shipped to the browser must be considered public.

---

# 7. SQL Injection

Never construct SQL like:

```js
const query = "SELECT * FROM users WHERE id = " + req.body.id;
```

Use:

- Parameterized queries
- Prepared statements
- Safe ORM APIs

Audit:

- [ ] Search
- [ ] Filters
- [ ] Sorting
- [ ] Dynamic columns
- [ ] Reports
- [ ] Admin tools
- [ ] Raw SQL
- [ ] Analytics queries

Be especially careful with dynamic:

```text
ORDER BY
LIMIT
OFFSET
column names
table names
```

---

# 8. Command Injection

Search for:

```text
exec
execSync
spawn
system
shell=True
subprocess
os.system
child_process
```

Check whether any user-controlled value enters shell commands.

Never do:

```js
exec("convert " + userInput);
```

Prefer safe library APIs or argument arrays.

---

# 9. XSS

Test:

- [ ] Stored XSS
- [ ] Reflected XSS
- [ ] DOM XSS
- [ ] Markdown XSS
- [ ] Rich-text editor XSS
- [ ] SVG XSS
- [ ] Filename XSS
- [ ] Profile/bio XSS
- [ ] Search parameter XSS
- [ ] Error-message XSS
- [ ] AI-generated HTML XSS

Search code for:

```text
dangerouslySetInnerHTML
innerHTML
outerHTML
document.write
v-html
```

Do not sanitize HTML using regex.

Use a mature HTML sanitizer when arbitrary HTML must be rendered.

---

# 10. CSRF

If authentication is cookie-based, check state-changing operations.

Protect:

- [ ] Change password
- [ ] Change email
- [ ] Delete account
- [ ] API key creation
- [ ] Organization invites
- [ ] Payments
- [ ] Subscription changes
- [ ] Account linking
- [ ] Security settings

Use:

- CSRF tokens where appropriate
- Appropriate `SameSite`
- Origin/referer validation where suitable

---

# 11. Session Security

Check cookies for:

```text
HttpOnly
Secure
SameSite
```

Verify:

- [ ] Session rotates after login.
- [ ] Logout invalidates session.
- [ ] Password change can invalidate old sessions.
- [ ] Sessions expire.
- [ ] Sensitive sessions have reasonable TTL.
- [ ] Auth tokens do not appear in URLs.
- [ ] Reset tokens do not appear in logs.
- [ ] Session identifiers are not predictable.

Avoid long-lived JWTs in `localStorage` unless there is a strong reason.

---

# 12. JWT Security

If using JWTs:

- [ ] Signature is always validated.
- [ ] Allowed algorithm is explicitly enforced.
- [ ] `exp` is validated.
- [ ] `iss` is validated.
- [ ] `aud` is validated.
- [ ] Key rotation is supported.
- [ ] Revocation strategy exists if needed.

Review dangerous header fields:

```text
alg
kid
jku
jwk
x5u
```

Do not implement JWT verification manually unless necessary.

---

# 13. OAuth / Social Login

Check:

- [ ] Exact redirect URI validation.
- [ ] `state` validation.
- [ ] PKCE.
- [ ] Authorization-code reuse blocked.
- [ ] Token leakage prevented.
- [ ] Email claim is verified.
- [ ] Account linking is secure.
- [ ] Existing accounts cannot be hijacked through OAuth linking.

Account-linking logic deserves manual testing.

---

# 14. API Security

Look for:

- Undocumented endpoints
- Old API versions
- Internal endpoints
- Admin endpoints
- Debug endpoints
- Staging endpoints
- Mobile-only endpoints
- GraphQL endpoints

Common paths:

```text
/api
/api/v1
/api/v2
/internal
/admin
/debug
/graphql
/swagger
/openapi.json
```

Test:

- [ ] Parameter tampering
- [ ] HTTP method switching
- [ ] Mass assignment
- [ ] Excessive data exposure
- [ ] Hidden fields
- [ ] Privilege escalation
- [ ] Rate-limit bypass
- [ ] Pagination abuse
- [ ] Large request bodies
- [ ] Expensive queries

---

# 15. Mass Assignment

Dangerous pattern:

```js
db.users.update({
  ...req.body
});
```

Protected fields might include:

```text
role
isAdmin
ownerId
userId
credits
balance
subscription
verified
permissions
plan
price
status
```

Use explicit allowlists:

```js
const allowed = {
  name: req.body.name,
  bio: req.body.bio
};
```

---

# 16. SSRF

Review anything that lets the server fetch a URL:

- Import from URL
- Website preview
- Webhook tester
- Image proxy
- PDF generator
- Screenshot service
- Avatar downloader
- Metadata fetcher
- RSS importer

Attack targets include:

```text
127.0.0.1
localhost
private IP ranges
cloud metadata endpoints
internal dashboards
Redis
Elasticsearch
Docker APIs
```

Mitigate with:

- Destination allowlists
- DNS/IP validation
- Redirect validation
- Egress filtering
- Internal-network isolation

Do not rely only on string blocklists.

---

# 17. File Upload Security

Test:

- [ ] Unrestricted extensions
- [ ] MIME spoofing
- [ ] Double extensions
- [ ] SVG active content
- [ ] HTML upload
- [ ] Polyglot files
- [ ] Oversized files
- [ ] ZIP bombs
- [ ] Archive traversal / ZIP Slip
- [ ] Filename path traversal
- [ ] Unicode filenames
- [ ] Malicious metadata
- [ ] File overwrite
- [ ] Predictable filenames
- [ ] Public exposure of private files

Never trust:

```text
Content-Type
filename
extension
```

from the browser.

Use server-generated filenames.

---

# 18. Path Traversal

Review features involving:

- Downloads
- Avatars
- Exports
- Templates
- Logs
- Backups
- File managers

Test traversal variants conceptually equivalent to:

```text
../
..\ 
encoded traversal
absolute paths
mixed separators
Unicode normalization tricks
```

Never concatenate untrusted file paths directly.

---

# 19. Webhook Security

For Stripe, GitHub, etc.:

- [ ] Verify signatures.
- [ ] Use raw request body if provider requires it.
- [ ] Reject invalid signatures.
- [ ] Protect against replay where appropriate.
- [ ] Make handlers idempotent.
- [ ] Never trust arbitrary webhook JSON.
- [ ] Verify event source.
- [ ] Verify event type.
- [ ] Verify resource belongs to expected account.

Do not mark a subscription paid merely because:

```json
{"paid": true}
```

appears in request JSON.

---

# 20. Payment Security

Never trust client-controlled:

```text
price
amount
currency
discount
plan
subscription status
payment status
```

Retrieve authoritative values server-side.

Test:

- [ ] Modify product ID.
- [ ] Modify plan ID.
- [ ] Modify price.
- [ ] Send negative amount.
- [ ] Send zero amount.
- [ ] Replay checkout confirmation.
- [ ] Skip payment step.
- [ ] Directly call success endpoint.
- [ ] Fake webhook.
- [ ] Reuse coupons.

---

# 21. Business Logic Attacks

Automated scanners often miss these.

Test whether users can:

- Reuse a coupon
- Claim repeated free trials
- Buy negative quantities
- Modify prices
- Change plan IDs
- Skip workflow steps
- Call final endpoint directly
- Reuse invitation links
- Accept expired invites
- Transfer ownership unexpectedly
- Spend credits twice
- Redeem rewards twice
- Use paid features directly via API
- Cancel after receiving irreversible benefits
- Abuse referral systems

Question every workflow:

```text
What assumptions does the server make about the sequence of operations?
```

Then intentionally violate those assumptions.

---

# 22. Race Conditions

Test simultaneous requests against:

- Coupons
- Credits
- Username claims
- Inventory
- Invitations
- Password resets
- Email verification
- Resource creation
- Quotas
- Payment operations

Dangerous pattern:

```text
check balance
then deduct
```

If those operations are not atomic, parallel requests may bypass limits.

Use:

- Database transactions
- Atomic updates
- Unique constraints
- Idempotency keys
- Locks where appropriate

---

# 23. CORS

Inspect:

```http
Access-Control-Allow-Origin
Access-Control-Allow-Credentials
```

Avoid unsafe configurations.

Do not blindly reflect the request `Origin`.

Explicitly allow trusted origins.

---

# 24. Security Headers

Verify:

```http
Content-Security-Policy
Strict-Transport-Security
X-Content-Type-Options: nosniff
Referrer-Policy
Permissions-Policy
```

For clickjacking protection:

```http
Content-Security-Policy: frame-ancestors ...
```

---

# 25. Clickjacking

Ensure sensitive actions cannot be embedded in attacker-controlled iframes.

Protect:

- Delete
- Approve
- Authorize
- Purchase
- Transfer
- Connect account
- Create API key
- OAuth approval

Use CSP `frame-ancestors`.

---

# 26. Open Redirects

Review parameters:

```text
next
redirect
return
returnUrl
callback
continue
url
```

Do not allow arbitrary external redirects.

Especially review login and OAuth flows.

---

# 27. Password Reset Poisoning

Reset links should not trust arbitrary:

```text
Host
X-Forwarded-Host
Origin
Forwarded
```

Generate reset links from trusted configuration.

---

# 28. Host Header Injection

Test unusual values for:

```text
Host
X-Forwarded-Host
X-Forwarded-Proto
Forwarded
```

Security-sensitive links should use configured canonical domains.

---

# 29. HTTP Request Smuggling / Desync

Relevant when using multiple HTTP layers:

```text
CDN
reverse proxy
load balancer
nginx
application server
```

Research/test:

```text
CL.TE
TE.CL
HTTP/2 downgrade issues
HTTP request desynchronization
```

Usually lower priority unless custom infrastructure is involved.

---

# 30. Web Cache Poisoning

Check whether attacker-controlled values influence cached responses.

Review:

- Query parameters
- Headers
- Host headers
- Forwarded headers
- Cache keys

Sensitive endpoints should not be cached improperly.

---

# 31. Web Cache Deception

Ensure private pages cannot be cached as static-looking URLs.

Review:

```text
/dashboard
/account
/settings
/api/me
```

Ensure one user's response cannot be served to another user.

---

# 32. Prototype Pollution

Relevant to JavaScript applications.

Audit:

- Deep merge libraries
- Query parsers
- Configuration merging
- Object assignment helpers

Dangerous property names:

```text
__proto__
constructor
prototype
```

Keep libraries updated.

---

# 33. DOM Clobbering

Relevant when rendering attacker-controlled HTML.

Review code that relies on:

```text
element IDs
named elements
global DOM references
```

Sanitize user-generated HTML.

---

# 34. postMessage Security

If using iframes, OAuth popups, or embedded widgets:

Do not accept messages blindly.

Validate:

```js
event.origin
event.data
```

Also verify message structure/schema.

---

# 35. WebSockets

Check:

- [ ] Connection authentication.
- [ ] Authorization per operation.
- [ ] Message validation.
- [ ] Rate limits.
- [ ] Origin handling.
- [ ] Secure reconnect handling.
- [ ] User IDs are not trusted from message body.

Test for Cross-Site WebSocket Hijacking.

---

# 36. GraphQL

If applicable:

- [ ] Authorization on every resolver.
- [ ] Nested authorization.
- [ ] Query depth limits.
- [ ] Query complexity limits.
- [ ] Pagination limits.
- [ ] Alias abuse resistance.
- [ ] Batch query limits.
- [ ] Subscription authorization.
- [ ] Field-level authorization.
- [ ] Introspection policy reviewed.

---

# 37. Email Change Security

Recommended flow:

```text
authenticated user
→ reauthentication
→ request change
→ verify new email
→ notify old email
```

Do not immediately replace email based only on client request.

---

# 38. Rate Limiting

Rate-limit:

- Login
- Signup
- Password reset
- OTP
- Email verification
- Search
- AI endpoints
- Uploads
- Exports
- Invite generation
- Expensive APIs
- Webhooks where appropriate

Potential dimensions:

```text
IP
account
email
session
endpoint
resource
```

Test bypass using alternate endpoints or accounts.

---

# 39. Denial of Service

Review attacker-controlled:

- Large JSON
- Deeply nested JSON
- Large file uploads
- Large image dimensions
- Regex input
- Search parameters
- GraphQL nesting
- Pagination limits
- Export generation
- PDF generation
- Archive extraction
- AI token usage

Also review ReDoS vulnerabilities in regex-heavy processing.

---

# 40. Frontend Information Leaks

Inspect production:

- JavaScript bundles
- Source maps
- Network requests
- localStorage
- sessionStorage
- IndexedDB
- Cookies
- HTML comments
- React state
- Next.js payloads
- Build metadata

Search frontend bundles for:

```text
SECRET
API_KEY
TOKEN
PASSWORD
ADMIN
INTERNAL
localhost
staging
supabase
firebase
stripe
AWS
PRIVATE
TODO
```

Anything delivered to the browser must be considered public.

---

# 41. Source Maps

Public source maps may reveal:

- Original source code
- Internal APIs
- Comments
- Hidden routes
- Developer paths
- Framework structure
- Debug details

Decide deliberately whether `.map` files should be public.

---

# 42. Hidden Routes

Enumerate:

```text
/admin
/debug
/test
/dev
/internal
/api
/api/v1
/api/v2
/graphql
/swagger
/docs
/openapi.json
/metrics
/health
/status
/.git
/.env
/backup
/tmp
/uploads
```

Review all forgotten endpoints.

---

# 43. Git Exposure

Ensure these are not web-accessible:

```text
.git/
.git/config
.git/HEAD
.env
.env.production
backup.zip
site-old.zip
database.sql
dump.sql
```

Also search GitHub for leaked credentials.

---

# 44. Error Handling

Production errors should not expose:

- Stack traces
- SQL statements
- Filesystem paths
- Framework versions
- DB credentials
- Internal hostnames
- Environment variables
- API secrets

Send deliberately malformed requests and inspect responses.

---

# 45. Dependency / Supply Chain Security

Audit:

- npm packages
- PyPI packages
- GitHub Actions
- Docker images
- CDN scripts
- Analytics scripts
- UI libraries
- Build plugins
- CI dependencies

Watch for:

- Known CVEs
- Abandoned libraries
- Typosquatting
- Dependency confusion
- Malicious install scripts
- Unexpected transitive dependencies
- Unpinned GitHub Actions

Commit lockfiles.

Avoid blindly instructing AI agents to:

```text
install whatever library fixes this
```

without reviewing the dependency.

---

# 46. GitHub / CI-CD Security

Audit:

```text
.github/workflows
```

Look for:

- Secrets exposed to pull requests
- Untrusted PR code running with secrets
- Excessive workflow permissions
- Unpinned actions
- Production credentials in CI
- Shell injection
- Deployment tokens
- Writable tokens where read-only is enough

Use least privilege.

---

# 47. Deployment Security

For Vercel, Netlify, Cloudflare, etc., review:

- Environment variable scopes
- Preview deployments
- Old deployments
- Deployment logs
- Build logs
- Serverless function logs
- Preview URLs
- Staging URLs
- Team permissions
- Deployment hooks
- Domain configuration

Check alternate domains such as:

```text
project-name.vercel.app
```

They should not expose weaker security than your custom domain.

---

# 48. Subdomain Takeover

Inventory:

```text
www
api
app
dev
staging
docs
blog
old
beta
preview
```

Look for stale DNS records pointing to deleted resources.

Review:

- CNAMEs
- Cloud apps
- GitHub Pages
- Hosting projects
- Storage buckets

---

# 49. DNS / Domain Security

Configure where applicable:

- SPF
- DKIM
- DMARC
- DNSSEC
- CAA

Protect your registrar account with MFA.

A compromised domain account can bypass most application security.

---

# 50. Cloud Storage

Check S3, R2, Supabase Storage, Firebase Storage, etc.

Private data must not be:

- Publicly listable
- Publicly readable
- Guessable
- Search-engine indexed

Use signed URLs for private files where appropriate.

Test with a completely unauthenticated browser.

---

# 51. Third-Party Scripts

Review every external script:

```html
<script src="..."></script>
```

Includes:

- Analytics
- Chat widgets
- Heatmaps
- Ads
- Payment widgets
- Support tools
- CDN libraries

Every third-party script increases supply-chain risk.

Use Subresource Integrity where practical.

---

# 52. CSP Review

A CSP is useful but not sufficient.

Weak directives include broad use of:

```text
unsafe-inline
unsafe-eval
*
```

Treat CSP as defense-in-depth.

Do not rely on CSP instead of proper sanitization and encoding.

---

# 53. Unicode Attacks

Review:

- Homoglyph usernames
- Unicode normalization
- Zero-width characters
- Right-to-left characters
- Confusable domains
- Case-folding inconsistencies

Normalize identifiers consistently.

---

# 54. TOCTOU Bugs

Time-of-check to time-of-use problems occur when you:

```text
check permission
then perform action
```

or:

```text
check balance
then deduct
```

or:

```text
check username availability
then create user
```

Use atomic database operations.

---

# 55. HTTP Parameter Pollution

Test duplicate parameters:

```text
?role=user&role=admin
```

Different layers may interpret duplicates differently:

- CDN
- WAF
- Reverse proxy
- Framework
- Application

Normalize and validate consistently.

---

# 56. Parsing Differentials

Different systems may interpret:

- URLs
- JSON
- HTTP headers
- Encodings
- Unicode
- Multipart bodies

differently.

This can enable:

- SSRF bypass
- WAF bypass
- Path traversal bypass
- Request smuggling

Minimize unnecessary parsing layers.

---

# 57. XS-Leaks

Advanced browser-side attacks may infer information through:

- Timing
- Window state
- Cache behavior
- Resource loading
- Frames
- Navigation side effects

Usually lower priority for small SaaS products, but relevant for sensitive systems.

---

# 58. Service Workers

If using a PWA:

- [ ] Review service worker scope.
- [ ] Do not cache sensitive data unnecessarily.
- [ ] Ensure logout clears relevant caches.
- [ ] Review offline authenticated content.
- [ ] Remove obsolete service workers.
- [ ] Prevent cache poisoning.

---

# 59. Client / Server Boundary Mistakes

Especially relevant to Next.js and similar frameworks.

Ensure server-only code never leaks into client bundles.

Be cautious when importing:

```text
database clients
admin SDKs
secret configuration
server authentication helpers
private environment variables
```

into modules reachable from client components.

---

# 60. AI / Vibe-Coding Specific Review

Search the codebase for:

```text
TODO security
temporary
for development
skip auth
disable auth
admin bypass
allow all
public
test user
mock auth
```

Common AI-generated mistakes include:

## Client-side admin check

```js
if (user.role === "admin") {
  showAdminPanel();
}
```

The backend must independently verify the role.

## Trusting client price

```js
const price = req.body.price;
```

The backend should load price from trusted data.

## Trusting client user ID

```js
const userId = req.body.userId;
```

Identity should come from the authenticated session.

## Overly broad database permissions

Bad conceptually:

```text
authenticated users can SELECT *
```

Better:

```text
authenticated users can SELECT rows they own
```

Review **trust boundaries**, not only individual lines.

---

# 61. Automated Security Testing Stack

Recommended tools:

## Static Analysis

```text
Semgrep
CodeQL
```

## Secret Scanning

```text
Gitleaks
TruffleHog
```

## Dependency Scanning

```text
OSV-Scanner
npm audit
pnpm audit
Trivy
```

## Dynamic Testing

```text
OWASP ZAP
Burp Suite
Nuclei
```

Do not treat:

```text
0 vulnerabilities found
```

as proof of security.

Automated scanners are weak at:

- IDOR
- Business logic
- Privilege escalation
- Workflow abuse
- Race conditions
- Multi-account authorization

---

# 62. Mandatory Multi-User Manual Test

Create:

```text
Anonymous
User A
User B
Paid User
Admin
```

For every endpoint ask:

```text
Can anonymous call it?

Can User A perform it on User B's object?

Can a free user perform the paid operation?

Can a normal user call the admin operation?

Can I change fields not exposed by the UI?

Can I invoke this endpoint without completing earlier workflow steps?

Can I replay it?

Can I call it 100 times simultaneously?
```

This catches a large percentage of severe SaaS vulnerabilities.

---

# 63. Suggested Severity Levels

## Critical

Block release immediately.

Examples:

- Remote code execution
- Authentication bypass
- Exposed production database
- Exposed service/admin key
- SQL injection
- Command injection
- Admin privilege escalation
- Payment manipulation

## High

Examples:

- IDOR exposing another user's data
- Stored XSS
- SSRF into internal systems
- Password-reset account takeover
- Private file disclosure
- Sensitive secret in frontend
- Broken organization isolation

## Medium

Examples:

- CSRF on meaningful operations
- Weak rate limits
- Clickjacking
- Open redirects
- Moderate information disclosure

## Low

Examples:

- Version disclosure
- Missing minor security headers
- Minor configuration issues

---

# 64. Recommended Testing Priority

For vibe-coded SaaS applications, prioritize in this order:

```text
1. Authorization / IDOR
2. Database / RLS
3. Secrets
4. Authentication
5. Business logic
6. Injection / XSS
7. Payments / Webhooks
8. SSRF / File uploads
9. Dependencies / Supply chain
10. CI/CD
11. Infrastructure
12. Browser/protocol edge cases
```

---

# 65. Final Pre-Launch Checklist

## Authentication

- [ ] Login secure
- [ ] Password reset secure
- [ ] OAuth secure
- [ ] MFA secure
- [ ] Sessions secure
- [ ] Rate limits present

## Authorization

- [ ] User A cannot access User B
- [ ] Free user cannot access paid features
- [ ] Normal user cannot access admin APIs
- [ ] Workspace isolation verified
- [ ] Organization isolation verified

## Data

- [ ] Database private
- [ ] RLS/security rules audited
- [ ] Private files protected
- [ ] Backups private

## Secrets

- [ ] Repository scanned
- [ ] Git history scanned
- [ ] Frontend bundle scanned
- [ ] CI logs checked
- [ ] Deployment logs checked
- [ ] Exposed credentials rotated

## Injection

- [ ] SQL injection tested
- [ ] Command injection tested
- [ ] XSS tested
- [ ] Path traversal tested
- [ ] SSRF tested

## APIs

- [ ] Hidden endpoints enumerated
- [ ] Rate limits tested
- [ ] Mass assignment tested
- [ ] Parameter tampering tested
- [ ] Old API versions reviewed

## Business Logic

- [ ] Payment manipulation tested
- [ ] Coupon abuse tested
- [ ] Trial abuse tested
- [ ] Workflow skipping tested
- [ ] Replay attacks tested
- [ ] Race conditions tested

## Infrastructure

- [ ] CORS reviewed
- [ ] Security headers configured
- [ ] DNS reviewed
- [ ] Subdomains inventoried
- [ ] Old deployments removed
- [ ] Cloud storage audited

## Supply Chain

- [ ] Dependencies scanned
- [ ] Lockfiles committed
- [ ] GitHub Actions reviewed
- [ ] CI token permissions minimized
- [ ] Third-party scripts reviewed

## Production Validation

- [ ] Test production anonymously
- [ ] Test production as normal user
- [ ] Test production as paid user
- [ ] Test production as admin
- [ ] Inspect production JS bundle
- [ ] Inspect source maps
- [ ] Inspect network requests
- [ ] Inspect cookies
- [ ] Inspect localStorage/sessionStorage
- [ ] Run DAST scanner against staging or authorized production target

---

# 66. Minimum Tooling Before Shipping

Run at least:

```bash
# Secrets
gitleaks detect

# Node dependencies
npm audit
# or
pnpm audit

# Dependency vulnerabilities
osv-scanner .

# Static analysis
semgrep scan --config auto

# Container/filesystem scanning if relevant
trivy fs .

# Dynamic application testing
# OWASP ZAP against your staging environment
```

Then manually test authorization and business logic using Burp Suite or browser DevTools.

---

# 67. Final Rule

A vibe-coded application should be treated as:

```text
UNTRUSTED UNTIL SECURITY-REVIEWED
```

The most important principle is:

```text
Never trust the client.
```

The browser can be modified.

Requests can be replayed.

Hidden buttons can be revealed.

JavaScript can be changed.

API requests can be forged.

IDs can be replaced.

Prices can be modified.

Roles can be changed in requests.

Frontend validation can be bypassed.

Every security decision must ultimately be enforced by trusted server-side logic.

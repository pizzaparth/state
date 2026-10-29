# State — Execution, Measured.

> **Parent Company:** Ksan Relay  
> **Domain:** `state.ksanrelay.in`  
> **Category:** Quantitative execution system  
> **Architecture:** Next.js App Router · Neon PostgreSQL · Drizzle ORM · Better Auth · Tailwind CSS · Flat AMOLED UI

---

## 1. Overview

**State** is a quantitative execution system for individuals and organisations. It transforms planned tasks and executed work into a deterministic, measurable history of output.

Unlike conventional productivity tools and to-do apps that focus on endless backlog grooming, gamification XP, and motivational quotes, State operates like a **measurement instrument**:

$$\text{Intent} \longrightarrow \text{Execution} \longrightarrow \text{Commit} \longrightarrow \text{History} \longrightarrow \text{Measurement}$$

- **Tasks represent intent:** What needs to happen, prioritised with execution weights.
- **Commits represent execution:** The canonical, immutable record of completed work.
- **State measures the difference:** Deterministic velocity, throughput, cycle time, and consistency.

---

## 2. Dual Visual Architecture

State features two visually unified yet deliberately distinct environments:

1. **Dark Brand & Marketing Surfaces (`#050505`):**
   - High-contrast, technical, editorial, monochrome.
   - Used for the public landing page, pricing, manifesto/principles, and authentication.
2. **AMOLED Black Product Environment (`#000000`):**
   - Flat, calm, dense. No neumorphism and no shadows.
   - Surfaces separated by 1px hairlines and small tonal steps (`styles/product.css`):
     - **Page (`#000`):** Body, tables, ledger rows, separators, graph labels.
     - **Panel (`#0A0A0A`):** Columns, toolbars, metric panels.
     - **Card / Control (`#121212`):** Buttons, draggable tasks, menus.
     - **Field (`#000` + hairline):** Search fields, inputs, progress rails, troughs.
   - Near-white inverse (`#F2F2EF`) reserved for focal elements such as `+ COMMIT` and the Today instrument.

---

## 3. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | Next.js 15 (App Router) | Full-stack server actions, route handlers, SSR, edge routing |
| **Language** | TypeScript | End-to-end type safety (schema, validation, UI, server) |
| **Styling** | Tailwind CSS + Custom Tokens | Flat AMOLED surfaces, responsive layout, CSS variables |
| **UI Primitives** | Radix UI | Accessible keyboard navigation, dialogs, popovers, tooltips |
| **Icons** | Lucide React | Unified 16px/18px/20px geometric icon set |
| **Animation** | Motion / CSS | Restrained 120ms–220ms interaction physics |
| **Kanban Drag & Drop** | `@dnd-kit` | Optimistic column reordering & card movement |
| **Database** | PostgreSQL / Neon | Relational execution ledger and snapshots |
| **ORM** | Drizzle ORM + Drizzle Kit | Type-safe SQL queries, migrations, and aggregations |
| **Authentication** | Better Auth | Email/Password with required email verification, password reset, OAuth (Google, GitHub), sessions |
| **Email** | Resend (HTTP API) | Verification and password reset links (`lib/email.ts`) |
| **Payments** | Razorpay + Stripe | India-first subscriptions (Razorpay) & global billing (Stripe) |
| **Validation** | Zod | Server actions, forms, webhooks, and deterministic input parsing |
| **Forms** | React Hook Form | Account, organisation, and project configuration |
| **Visualisation** | Recharts + Custom SVG | Execution metrics and signature horizontal execution graph |

---

## 4. Directory Structure

```text
state/
├── app/
│   ├── (marketing)/             # Dark theme public marketing surfaces
│   │   ├── page.tsx             # Landing hero & product thesis
│   │   ├── pricing/page.tsx     # Paid subscription tiers
│   │   └── principles/page.tsx  # Non-negotiable product manifesto
│   ├── (auth)/                  # Dark inset authentication flows
│   │   ├── login/page.tsx       # Email / OAuth authentication
│   │   ├── register/page.tsx    # Workspace registration (sends a verification link)
│   │   ├── verify-email/        # Landing for the emailed verification link
│   │   ├── forgot-password/     # Request a reset link
│   │   └── reset-password/      # Choose a new password from the emailed link
│   ├── (app)/                   # AMOLED black logged-in workspace
│   │   ├── today/page.tsx       # Default daily work surface & targets
│   │   ├── inbox/page.tsx       # Rapid capture & deterministic syntax triage
│   │   ├── activity/page.tsx    # 90-day horizontal execution matrix
│   │   ├── history/page.tsx     # Canonical commit ledger
│   │   ├── metrics/page.tsx     # Quantitative throughput & cycle-time analytics
│   │   ├── personal/page.tsx    # Default personal execution board
│   │   ├── projects/            # Project list & /projects/[projectSlug]
│   │   ├── org/                 # Organisation list & /org/[orgSlug]/{board,projects,members,metrics}
│   │   └── settings/            # Account, billing, preferences
│   ├── api/                     # Server Route Handlers
│   │   ├── auth/[...all]/       # Better Auth Next.js endpoint
│   │   ├── health/              # Service health monitor
│   │   └── webhooks/            # Razorpay & Stripe signed webhook handlers
│   └── layout.tsx               # Root layout & font definitions
│
├── components/
│   ├── ui/                      # Shared button primitive
│   ├── app/                     # Product shell, boards, ledger, graph, metrics views
│   └── marketing/               # Landing page sections and particle field
│
├── db/
│   ├── schema/                  # Relational Drizzle schema definitions
│   │   ├── users.ts             # User identities & Better Auth tables
│   │   ├── workspaces.ts        # Personal & organisation workspaces
│   │   ├── organisations.ts     # Org metadata & member roles
│   │   ├── projects.ts          # Project delivery containers
│   │   ├── boards.ts            # Boards per workspace/project
│   │   ├── columns.ts           # Kanban stage columns
│   │   ├── tasks.ts             # Planned work units & weights
│   │   ├── commits.ts           # Canonical execution ledger
│   │   ├── tags.ts              # Categorisation tags & mappings
│   │   ├── subscriptions.ts     # Subscription state & provider links
│   │   ├── metrics.ts           # Pre-calculated metric snapshots
│   │   ├── objectives.ts        # Measurable objectives & project/task links
│   │   ├── events.ts            # Audit events & notifications
│   │   └── index.ts             # Schema bundle export
│   ├── migrations/              # Generated SQL migrations
│   ├── queries/                 # Reusable Drizzle query functions
│   └── index.ts                 # Neon WebSocket Pool, or node-postgres for localhost (both support transactions)
│
├── lib/
│   ├── auth/                    # Better Auth server configuration
│   ├── billing/                 # Razorpay & Stripe client instances
│   ├── validation/              # Zod input schemas & quick parser
│   └── utils.ts                 # Classname merge utility (cn)
│
├── middleware.ts                # Redirects signed-out requests on product routes to /login
│
├── styles/
│   ├── tokens.css               # Design system variables (colors, radii, motion)
│   ├── product.css              # Flat AMOLED product surfaces (app-panel, app-card, …)
│   └── globals.css              # Tailwind base, tabular numbers, focus rings
│
└── docs/                        # Complete product specifications & inspiration
    ├── state_desc.md            # Comprehensive product specification
    ├── style.md                 # Visual design system & style guide
    ├── techstack.md             # Technical architecture & deployment guide
    └── inspo/                   # UI reference assets & product renders
```

---

## 5. Core Mathematical Formulas

State calculations are completely deterministic and transparent:

1. **Total Execution:**
   $$\text{Execution} = \sum \text{completed task weights} + \sum \text{manual commit weights}$$
   *(Default weights: Small = 1, Normal = 2, Major = 4, Milestone = 8)*
2. **Velocity:**
   $$\text{Velocity} = \frac{\text{Execution}}{\text{Period in Days}}$$
3. **Throughput:**
   $$\text{Throughput} = \frac{\text{Completed Tasks}}{\text{Period}}$$
4. **Completion Ratio:**
   $$\text{Completion Ratio} = \frac{\text{Completed Planned Tasks}}{\text{Total Planned Tasks}} \times 100\%$$
5. **Cycle Time:**
   $$\text{Cycle Time} = \text{Median}(\text{completed\_at} - \text{started\_at})$$
6. **Consistency:**
   $$\text{Consistency} = \frac{\text{Active Days (Days with } \ge 1 \text{ commit)}}{\text{Eligible Days}} \times 100\%$$

---

## 6. Getting Started

### Prerequisites

- Node.js `v20+` or `v22+` (tested on Node `26.8.1`)
- npm `v10+` or `v11+`
- PostgreSQL: a Neon database, or a local Postgres for development (`localhost` URLs use `node-postgres`; everything else uses Neon's WebSocket driver)

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ksanrelay/state.git
   cd state
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Copy the example environment file and configure your database connection:
   ```bash
   cp .env.example .env
   ```

4. **Database Migration & Schema Sync:**
   ```bash
   # Generate migrations from Drizzle schema
   npm run db:generate

   # Push schema directly to database (development)
   npm run db:push

   # Or apply the committed migrations in db/migrations
   npm run db:migrate

   # Launch Drizzle Studio database explorer
   npm run db:studio
   ```

5. **Seed demo data (local only):**
   ```bash
   npm run db:seed
   ```
   Recreates three demo users with about 90 days of history. See
   [Demo credentials](#demo-credentials). The script refuses any database that is not
   on localhost (override with `SEED_ALLOW_REMOTE=1` for a disposable staging database).

6. **Start Development Server:**
   ```bash
   npm run dev
   ```

7. **Checks:**
   ```bash
   npm run lint
   npm run typecheck
   npm run build
   npm run authz:check     # BOLA/IDOR suite, needs a seeded *_test database
   npm run security:check  # black-box suite against a running build
   ```
   See [docs/security.md](docs/security.md) for the test database setup.
   Open [http://localhost:3000](http://localhost:3000) to view the application.

### Demo credentials

Created by `npm run db:seed` in your local database. Sign in at
[http://localhost:3000/login](http://localhost:3000/login).

| User | Email | Password | Role in Ksan Relay |
| :--- | :--- | :--- | :--- |
| Parth (main demo account) | `demo@state.test` | `state-demo-2026` | Owner |
| Aarav Kulkarni | `aarav@state.test` | `state-demo-2026` | Admin |
| Ishita Sharma | `ishita@state.test` | `state-demo-2026` | Member |

All three have an active subscription, so sign-in goes straight to Today. Board moves,
Inbox captures and manual commits are saved to the database. These accounts exist only in
databases you seed yourself; the seed refuses remote databases.

### Email in development

Without `RESEND_API_KEY`, `npm run dev` prints every verification and reset email (with its
link) to the dev server console. Accounts created before verification was required can sign
in once they open the link sent on their next sign-in attempt. Production refuses to start
without `RESEND_API_KEY` and `EMAIL_FROM`.

---

## 7. Billing (paid from day one)

State has no free plan and no trial. The flow is:

1. `/register` creates the account and emails a verification link. No session exists until it is opened; the link signs the user in and forwards to `/subscribe` (plan and interval carry over from the pricing CTA).
2. `POST /api/billing/checkout` opens Razorpay Checkout for India (`x-vercel-ip-country: IN`, also the local default) or a Stripe Checkout session elsewhere.
3. Razorpay success is signature-checked at `POST /api/billing/razorpay/verify`; both providers' webhooks (`/api/webhooks/*`) upsert the `subscriptions` row.
4. First activation provisions the personal workspace, board and columns.
5. The `(app)` layout checks session and paid access server-side; unpaid users are sent to `/subscribe`.

Configure plan and price IDs in `.env` (`RAZORPAY_PLAN_*`, `STRIPE_PRICE_*`). Display prices live in `lib/billing/plans.ts`; keep them in sync with the provider dashboards.

---

## 8. Quality & Architecture Rules

- **Zero AI Slop:** No generative text summaries, unsolicited suggestions, or LLM-generated chatter.
- **Zero Surveillance:** No mouse tracking, keystroke counting, or forced team leaderboards.
- **Deterministic First:** All metrics must be mathematically explainable.
- **Flat AMOLED Product:** Use the surface classes in `styles/product.css`. No neumorphism, no shadows; hairlines and tonal steps only.
- **Accessible & Keyboard First:** Full `⌘K` command palette support, visible focus rings, tabular numbers for comparative data.

# State — Execution, Measured.

> **Parent Company:** Ksan Relay  
> **Domain:** `state.ksanrelay.in`  
> **Category:** Quantitative execution system  
> **Architecture:** Next.js App Router · Neon PostgreSQL · Drizzle ORM · Better Auth · Tailwind CSS · Restrained Neumorphism

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
2. **Pale Neumorphic Product Environment (`#D9D9D5`):**
   - Sculpted, tactile, calm, restrained neumorphism.
   - Physical depth hierarchy:
     - **Level 0 (Flat):** Base surface, tables, separators, graph labels.
     - **Level 1 (Slightly Raised):** Columns, toolbars, metric panels.
     - **Level 2 (Raised Control):** Buttons, draggable tasks, interactive cards.
     - **Level -1 (Inset):** Search fields, inputs, progress rails, troughs.

---

## 3. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | Next.js 15 (App Router) | Full-stack server actions, route handlers, SSR, edge routing |
| **Language** | TypeScript | End-to-end type safety (schema, validation, UI, server) |
| **Styling** | Tailwind CSS + Custom Tokens | Restrained neumorphism, responsive layout, CSS variables |
| **UI Primitives** | Radix UI | Accessible keyboard navigation, dialogs, popovers, tooltips |
| **Icons** | Lucide React | Unified 16px/18px/20px geometric icon set |
| **Animation** | Motion / CSS | Restrained 120ms–220ms interaction physics |
| **Kanban Drag & Drop** | `@dnd-kit` | Optimistic column reordering & card movement |
| **Database** | PostgreSQL / Neon | Relational execution ledger and snapshots |
| **ORM** | Drizzle ORM + Drizzle Kit | Type-safe SQL queries, migrations, and aggregations |
| **Authentication** | Better Auth | Email/Password, OAuth (Google, GitHub), session management |
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
│   │   └── register/page.tsx    # Workspace registration
│   ├── (app)/                   # Pale neumorphic logged-in workspace
│   │   ├── today/page.tsx       # Default daily work surface & targets
│   │   ├── inbox/page.tsx       # Rapid capture & deterministic syntax triage
│   │   ├── activity/page.tsx    # 90-day horizontal execution matrix
│   │   ├── history/page.tsx     # Canonical commit ledger
│   │   ├── metrics/page.tsx     # Quantitative throughput & cycle-time analytics
│   │   ├── personal/page.tsx    # Default personal execution board
│   │   ├── projects/page.tsx    # Project delivery streams
│   │   └── org/page.tsx         # Multi-member team execution board
│   ├── api/                     # Server Route Handlers
│   │   ├── auth/[...all]/       # Better Auth Next.js endpoint
│   │   ├── health/              # Service health monitor
│   │   └── webhooks/            # Razorpay & Stripe signed webhook handlers
│   └── layout.tsx               # Root layout & font definitions
│
├── components/
│   ├── ui/                      # Tactile buttons, inset inputs, cards
│   ├── board/                   # Kanban columns & card containers
│   ├── commits/                 # Commit items & ledger entries
│   ├── execution/               # Horizontal execution graph cells & matrix
│   ├── metrics/                 # Quantitative metric cards
│   └── navigation/              # Pale vertical side rail & minimal topbar
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
│   │   └── index.ts             # Schema bundle export
│   ├── migrations/              # Generated SQL migrations
│   ├── queries/                 # Reusable Drizzle query functions
│   └── index.ts                 # Neon serverless client connection
│
├── lib/
│   ├── auth/                    # Better Auth server configuration
│   ├── billing/                 # Razorpay & Stripe client instances
│   ├── execution/               # Task weight constants & graph calculations
│   ├── metrics/                 # Deterministic formulas (Velocity, Cycle Time, etc.)
│   ├── validation/              # Zod input schemas & quick parser
│   └── utils.ts                 # Classname merge utility (cn)
│
├── styles/
│   ├── tokens.css               # Design system variables (colors, radii, shadows)
│   ├── neumorphism.css          # Restrained neumorphic depth physics
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
- PostgreSQL database (or Neon Serverless account)

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

   # Launch Drizzle Studio database explorer
   npm run db:studio
   ```

5. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 7. Quality & Architecture Rules

- **Zero AI Slop:** No generative text summaries, unsolicited suggestions, or LLM-generated chatter.
- **Zero Surveillance:** No mouse tracking, keystroke counting, or forced team leaderboards.
- **Deterministic First:** All metrics must be mathematically explainable.
- **Restrained Neumorphism:** Strictly adhere to depth levels (0, 1, 2, -1). Never produce arbitrary heavy shadows.
- **Accessible & Keyboard First:** Full `⌘K` command palette support, visible focus rings, tabular numbers for comparative data.

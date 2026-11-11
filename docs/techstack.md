> **Note (November 2026):** State now ships as a personal hobby project by Parth Pancholi. There are no payments, pricing, organisations, sign-up or email flows; the owner signs in with an access code and everyone else uses a throwaway demo. Sections below that describe those removed features are kept as historical design notes. See README.md and AGENTS.md for the current rules.

# State — Final Tech Stack

**Product:** State by Parth Pancholi  
**Domain:** `<your-app>.vercel.app`  
**Purpose:** MVP and initial production architecture  
**Architecture principle:** Ship as a single full-stack application first. Split infrastructure only when usage justifies it.

---

# 1. Final Stack

```text
╭────────────────────────────────────╮
│               STATE  (PARTH)          │
├────────────────────────────────────┤
│                                    │
│ Frontend                           │
│ Next.js + React + TypeScript       │
│ Tailwind CSS + Radix UI            │
│ Motion + dnd-kit + Lucide          │
│                                    │
│ Application Layer                  │
│ Next.js App Router                 │
│ Server Actions                     │
│ Route Handlers                     │
│                                    │
│ Data                               │
│ PostgreSQL / Neon                  │
│ Drizzle ORM                        │
│                                    │
│ Authentication                     │
│ Better Auth                        │
│                                    │
│ Payments                           │
│ Razorpay + Stripe                  │
│                                    │
│ Validation                         │
│ Zod                                │
│                                    │
│ Forms                              │
│ React Hook Form                    │
│                                    │
│ Charts                             │
│ Recharts                           │
│ Custom SVG/CSS Execution Graph     │
│                                    │
│ State Management                   │
│ React state                        │
│ Zustand where necessary            │
│                                    │
│ Dates                              │
│ date-fns                           │
│                                    │
│ Monitoring                         │
│ Sentry                             │
│                                    │
│ Hosting                            │
│ Vercel                             │
│                                    │
├────────────────────────────────────┤
│ LATER                              │
│ Go API                             │
│ Redis                              │
│ Workers                            │
│ WebSockets                         │
│ Public API                         │
│ CLI                                │
└────────────────────────────────────╯
```

---

# 2. Frontend

## Next.js

Use Next.js as the main application framework.

Responsibilities:

- public landing page
- authentication pages
- pricing
- authenticated product UI
- server-rendered pages
- API endpoints
- server-side data fetching
- billing webhooks
- application routing

Use:

```text
Next.js App Router
```

Do not use the Pages Router for the new application.

---

## React

React powers all interactive product surfaces.

Primary use cases:

- kanban board
- drag-and-drop tasks
- command palette
- quick task creation
- commit history
- execution graph
- metrics
- organisation views
- project views

---

## TypeScript

Use TypeScript across the complete web application.

Scope:

- frontend components
- server logic
- database types
- validation
- API contracts
- billing code
- auth code

---

# 3. Styling

## Tailwind CSS

Use Tailwind CSS for layout, spacing, responsiveness, typography, and utility styling.

Use custom CSS variables for the State design system.

Example:

```css
--app-bg: #000000;
--app-panel: #0a0a0a;
--app-raised: #121212;
--app-line: rgba(255,255,255,.08);
--app-line-strong: rgba(255,255,255,.14);

--app-text-primary: #f2f2ef;
--app-text-secondary: #9a9a96;
--app-text-tertiary: #85857f;
```

The product is flat AMOLED black: no neumorphism and no shadows. Use the surface classes in `styles/product.css` rather than arbitrary inline styles.

---

## Radix UI

Use Radix UI only as accessible behaviour primitives.

Recommended primitives:

- Dialog
- Dropdown Menu
- Popover
- Tooltip
- Tabs
- Select
- Context Menu

Do not use Radix as a visual design system.

All components should be styled according to the State visual system.

---

# 4. Icons

## Lucide

Use:

```text
lucide-react
```

Use one icon family throughout the product.

Recommended sizes:

```text
16px
18px
20px
```

Avoid mixing icon libraries.

---

# 5. Motion

## Motion

Use Motion for restrained interaction animation.

Use it for:

- drag lift
- task drop
- modal opening
- command palette
- sidebar transitions
- button press (fill drops to page black)
- small surface transitions

Recommended animation range:

```text
120–220ms
```

Avoid unnecessary decorative motion.

---

# 6. Kanban Drag and Drop

## dnd-kit

Use:

```text
@dnd-kit/core
@dnd-kit/sortable
```

Primary use cases:

- moving tasks between columns
- ordering tasks inside columns
- moving items between boards where supported

Interaction model:

```text
drag
↓
optimistic local update
↓
persist change
↓
rollback only if persistence fails
```

The board should feel immediate.

---

# 7. Application Layer

Use Next.js itself as the MVP backend.

No separate backend service is required at launch.

Use:

- Server Components
- Server Actions
- Route Handlers

Typical operations:

```text
task create
task update
task complete
task move
commit create
project create
organisation create
metrics query
billing webhook
auth
```

This keeps the MVP inside one deployable application.

---

# 8. Database

## PostgreSQL

Use PostgreSQL as the primary datastore.

It fits State because the data model is strongly relational.

Core entities:

```text
users
workspaces
organisations
organisation_members
boards
columns
projects
tasks
commits
tags
task_tags
objectives
subscriptions
audit_events
notifications
metric_snapshots
```

Do not use MongoDB for the primary datastore.

---

# 9. PostgreSQL Hosting

## Neon

Use Neon for managed PostgreSQL during the MVP and initial production stage.

Architecture:

```text
Vercel
   │
   ▼
Neon PostgreSQL
```

Benefits:

- managed PostgreSQL
- simple deployment
- good serverless compatibility
- database branching
- no database infrastructure maintenance

---

# 10. ORM

## Drizzle ORM

Use:

```text
Drizzle ORM
Drizzle Kit
```

Reasons:

- strong TypeScript integration
- stays close to SQL
- suitable for PostgreSQL
- good for quantitative and aggregation-heavy queries
- lightweight

State will eventually require queries such as:

```text
execution per day
rolling velocity
median cycle time
completion ratios
project throughput
active days
commit frequency
percentiles
```

Direct SQL flexibility is valuable.

---

# 11. Authentication

## Better Auth

Use Better Auth.

Initial authentication methods:

```text
Email + password
Google
GitHub
```

Architecture:

```text
Next.js
   │
Better Auth
   │
Drizzle
   │
PostgreSQL
```

Auth data should remain in the same PostgreSQL environment as the application unless there is a strong reason to separate it later.

---

# 12. Payments

State has no permanent free plan.

## Razorpay

Use Razorpay for India-first subscription payments.

Use cases:

- individual subscriptions
- organisation subscriptions
- recurring billing

## Stripe

Use Stripe for international billing when needed.

Possible approach:

```text
India          → Razorpay
International  → Stripe
```

Subscription state should also be stored internally.

Suggested table:

```text
subscriptions

id
user_id
organisation_id
provider
provider_customer_id
provider_subscription_id
plan
status
current_period_start
current_period_end
created_at
updated_at
```

Billing flow:

```text
payment provider
      ↓
signed webhook
      ↓
verify webhook
      ↓
update subscriptions table
      ↓
application checks local subscription state
```

---

# 13. Validation

## Zod

Use Zod for:

- form input validation
- server action validation
- API inputs
- query parameters
- environment variables
- billing payload parsing
- auth-related input

Example task schema:

```text
title        required
projectId    optional
dueAt        optional
priority     optional
weight       1 | 2 | 4 | 8
```

---

# 14. Forms

## React Hook Form

Use React Hook Form for larger structured forms.

Examples:

- account settings
- organisation settings
- project forms
- billing forms
- objective forms

Do not use it unnecessarily for one-field quick interactions.

Quick task creation should remain lightweight.

---

# 15. State Management

Do not use Redux.

Primary state model:

```text
React local state
+
server state
+
Zustand where necessary
```

Use Zustand only for cross-component client UI state such as:

- sidebar state
- command palette state
- board drag state
- temporary optimistic state
- interface preferences

Do not use Zustand as a replacement for PostgreSQL-backed application state.

---

# 16. Data Fetching

Prefer native Next.js patterns initially.

Use:

- Server Components
- Server Actions
- Route Handlers

For highly interactive board behaviour:

```text
client state
+
optimistic mutation
+
server persistence
```

Do not add TanStack Query to the MVP unless the application becomes sufficiently client-heavy to justify it.

---

# 17. Charts

## Recharts

Use Recharts for standard quantitative visualisations.

Examples:

- velocity
- execution trend
- completion trend
- throughput
- cycle-time distribution

## Custom Execution Graph

The signature horizontal execution graph should be built manually.

Use:

- SVG
- CSS Grid
- Canvas only if genuinely needed later

Do not use a generic chart component for the execution graph.

The execution graph is part of State's visual identity.

---

# 18. Dates and Time

## date-fns

Use:

```text
date-fns
```

for client and server date handling.

Store all timestamps in UTC.

Flow:

```text
UTC storage
    ↓
user timezone
    ↓
local display
```

This is especially important for:

- daily execution graph
- commit history
- recurring tasks
- Today view
- organisation metrics

---

# 19. Search

Start with PostgreSQL.

Do not use Elasticsearch for the MVP.

Use:

- `ILIKE`
- trigram indexes
- PostgreSQL full-text search where useful

Searchable entities:

```text
tasks
commits
projects
organisations
members
tags
```

Later query syntax can support:

```text
project:relaydb
type:commit
after:2026-10-01
user:parth
status:active
```

The search parser should remain deterministic.

---

# 20. Realtime

Do not build realtime collaboration for the first MVP unless necessary.

Use optimistic UI first.

Example:

```text
user moves card
      ↓
UI updates instantly
      ↓
server persists
      ↓
success
```

Later, when organisations require simultaneous editing, introduce realtime events.

Potential events:

```text
task.created
task.updated
task.moved
task.completed
commit.created
project.updated
```

---

# 21. Background Jobs

No dedicated queue is needed at first.

Handle simple operations inline.

Add background infrastructure later for:

- recurring task generation
- email notifications
- large exports
- metric aggregation
- webhook retries
- organisation reports
- scheduled processing

Later stack:

```text
Redis
+
BullMQ or equivalent worker system
```

---

# 22. Monitoring

## Sentry

Use Sentry from the beginning.

Monitor:

- frontend crashes
- server exceptions
- failed database operations
- auth issues
- billing webhook failures
- production errors

This should be part of the initial production setup.

---

# 23. Product Analytics

Keep analytics minimal.

Track only product-level events such as:

```text
account.created
subscription.started
task.created
task.completed
commit.created
project.created
organisation.created
```

Do not send user task descriptions or private project content to analytics providers.

---

# 24. Deployment

## Vercel

Deploy the Next.js application on Vercel.

Architecture:

```text
<your-app>.vercel.app
        │
        ▼
      Vercel
        │
        ├── landing page
        ├── auth
        ├── application
        ├── API
        ├── billing webhooks
        └── server logic
                 │
                 ▼
          Neon PostgreSQL
```

Use Vercel Pro for the commercial production deployment.

Vercel Hobby can be used during development.

---

# 25. Suggested Repository Structure

```text
state/
│
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx
│   │   ├── pricing/
│   │   └── principles/
│   │
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   │
│   ├── (app)/
│   │   ├── today/
│   │   ├── inbox/
│   │   ├── activity/
│   │   ├── history/
│   │   ├── metrics/
│   │   ├── personal/
│   │   ├── projects/
│   │   └── org/
│   │
│   └── api/
│
├── components/
│   ├── ui/
│   ├── board/
│   ├── commits/
│   ├── execution/
│   ├── metrics/
│   └── navigation/
│
├── db/
│   ├── schema/
│   ├── migrations/
│   ├── queries/
│   └── index.ts
│
├── lib/
│   ├── auth/
│   ├── billing/
│   ├── metrics/
│   ├── execution/
│   └── validation/
│
├── styles/
│   ├── tokens.css
│   ├── product.css
│   └── globals.css
│
└── public/
```

---

# 26. MVP Architecture

The MVP should remain a modular monolith.

```text
Browser
   │
   ▼
Next.js / Vercel
   │
   ├── UI
   ├── Auth
   ├── Business Logic
   ├── API
   ├── Metrics
   └── Billing
          │
          ▼
    Neon PostgreSQL
```

This is intentionally simple.

Do not introduce distributed architecture before there is a real operational need.

---

# 27. Later Architecture

If State grows sufficiently, extract the backend.

Recommended future backend:

```text
Go
```

Future architecture:

```text
                   ┌── Next.js / Vercel
                   │
Internet ──────────┤
                   │
                   └── api.<your-app>.vercel.app
                              │
                              ▼
                             Go
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
                PostgreSQL            Redis
                    │
                    ▼
                  Workers
```

Use Go rather than Rust for State.

Rust is better reserved for systems-oriented products such as RelayDB.

State's backend workload is primarily:

- HTTP
- auth
- SQL
- metrics
- application business logic
- events
- realtime
- subscriptions

Go is a strong fit for that workload.

---

# 28. Technologies Not Needed for MVP

Avoid:

```text
MongoDB
Firebase
Kubernetes
GraphQL
Elasticsearch
Kafka
Microservices
Redux
Separate analytics database
Separate Go backend
AI SDKs
LLM APIs
```

These add complexity without improving the initial product.

---

# 29. Final Recommendation

Launch State as:

```text
Next.js
React
TypeScript
Tailwind CSS
Radix UI
Motion
dnd-kit
Lucide

PostgreSQL
Neon
Drizzle ORM

Better Auth

Razorpay
Stripe

Zod
React Hook Form
Zustand
date-fns
Recharts

Sentry

Vercel
```

The first production version should be:

```text
one Next.js application
+
one PostgreSQL database
```

Only split the backend into Go, add Redis, workers, realtime infrastructure, or other services when actual product usage creates a concrete need.

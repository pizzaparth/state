# State — Execution, Measured.

> A personal hobby project by **Parth Pancholi**.
> **Hosting:** Vercel · **Stack:** Next.js App Router · Neon PostgreSQL · Drizzle ORM · Better Auth (sessions only) · Tailwind CSS

---

## 1. Overview

State is a to-do list and kanban board that measures finished work. Tasks are the plan; when a task reaches Done it becomes a commit, and commits turn into deterministic metrics:

$$\text{Intent} \longrightarrow \text{Execution} \longrightarrow \text{Commit} \longrightarrow \text{History} \longrightarrow \text{Measurement}$$

It is not a product for sale. There are no payments, no pricing, no sign-up, no organisations and no contact details.

### Who can use it

| Who | How | What is kept |
| :--- | :--- | :--- |
| **Owner** (Parth) | `/login` with the access code in `OWNER_CODE` | Everything, permanently. The session ends when the browser closes. |
| **Anyone else** (recruiters, visitors) | **Take a demo** (`/demo`) | Nothing. A throwaway workspace with 60 days of sample data. It survives a refresh and is deleted on sign-out, on tab close, or after 6 hours. |

How the demo is cleaned up (`lib/demo/session.ts`, `lib/demo/tab.ts`):

- **Sign-out / End demo:** the demo account is deleted at once; its workspace, tasks, commits and sessions cascade.
- **Tab closed:** the tab keeps a `sessionStorage` marker. A later visit without the marker asks other open tabs over a `BroadcastChannel`; if none holds the demo, it is deleted.
- **Abandoned:** demo accounts older than 6 hours are pruned whenever a new demo starts.

---

## 2. Visual system

- **Palette:** 75% navy `#001A33` and white `#FFFFFF`, 25% accent `#D92B74`. Text on the accent is navy (WCAG AA); white text on the accent is never used. Small accent text uses the lighter `#FF5C99` so it passes AA on every layer.
- **Layered parallax:** three tiled layers (far dots, mid outlines, near marks) sit behind every page and move at different speeds with scroll and pointer; hero type and headings drift on their own depth (`components/motion/parallax.tsx`). Panels are translucent so the layers read through. Off under reduced motion.
- **Micro-interactions:** press, lift, nudge, spin, underline, row and pop effects from `styles/motion.css`, transform/opacity only.
- Tokens live in `styles/tokens.css`; surface classes in `styles/product.css`; Tailwind exposes `accent`.

---

## 3. Metrics

1. **Execution** = Σ completed task weights + Σ manual commit weights (Small 1, Normal 2, Major 4, Milestone 8)
2. **Velocity** = Execution ÷ period in days
3. **Throughput** = completed tasks ÷ period
4. **Completion ratio** = completed planned tasks ÷ planned tasks × 100%
5. **Cycle time** = median(completed_at − started_at)
6. **Consistency** = active days (≥ 1 commit) ÷ eligible days × 100%

---

## 4. Layout

```text
app/
├── (marketing)/      Landing, principles, comparisons
├── (auth)/           /login (owner code), /demo (starts a demo), session Server Actions
├── (app)/platform/   Today, Inbox, Activity, History, Metrics, Personal board, Projects, Settings
└── api/              export, import, search, health
lib/
├── auth/             better-auth (sessions only) and the owner account
├── demo/             demo sessions, tab marker, sample data, landing-page demo data
├── mutations.ts      every product write (re-checks workspace ownership)
└── validation/       strict Zod schemas and the quick-capture parser
db/                   Drizzle schema, migrations and queries
scripts/              authz-check.ts, security-check.mjs, bench.mjs
```

---

## 5. Running locally

```bash
git clone https://github.com/pizzaparth/state.git
cd state
npm install
cp .env.example .env      # set DATABASE_URL, BETTER_AUTH_SECRET and OWNER_CODE
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`, then either **Take a demo** or sign in at `/login` with your `OWNER_CODE`. The owner account is created on the first correct sign-in.

Never commit the real `OWNER_CODE`; `.env` is git-ignored.

---

## 6. Deploying on Vercel

1. Import `pizzaparth/state` into Vercel (framework: Next.js).
2. Create a Neon database and use its **pooled** connection string.
3. Set environment variables:

| Variable | Value |
| :--- | :--- |
| `DATABASE_URL` | Neon pooled connection string |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `OWNER_CODE` | your access code |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | optional; default to the Vercel production domain |

4. Run migrations against Neon once: `DATABASE_URL=… npm run db:migrate`. Migration `0016` deletes every earlier account, so the deployment starts clean.
5. Deploy. Production refuses to start without `BETTER_AUTH_SECRET`, `DATABASE_URL` and `OWNER_CODE` (`lib/env.ts`).

---

## 7. Checks

```bash
npm run typecheck && npm run lint

# Tenant isolation (owner and demos are separate tenants), on a *_test database
DATABASE_URL=postgresql://$USER@localhost:5432/state_security_test npm run db:migrate
DATABASE_URL=postgresql://$USER@localhost:5432/state_security_test npm run authz:check

# Black-box suite against a production build on that database
OWNER_CODE=… npm run build && OWNER_CODE=… PORT=3123 npm start
BASE_URL=http://localhost:3123 DATABASE_URL=… node scripts/security-check.mjs
```

---

## 8. Rules

- No AI summaries, no gamification, no surveillance, no unexplained scores.
- Every metric shows its formula.
- No sign-up, payments, organisations or contact details.
- Credit stays visible: "A personal hobby project by Parth Pancholi".

See `AGENTS.md` for the full engineering and design rules.

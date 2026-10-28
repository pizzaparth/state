# State — Product & Engineering Rules for Agents

Concise rules for building accessible, fast, delightful UIs and maintaining State's quantitative architecture. Use MUST/SHOULD/NEVER to guide decisions.

---

## Product Philosophy & Invariants

### Execution Model
- MUST: Treat work as a deterministic lifecycle: `Intent → Execution → Commit → History → Measurement`.
- MUST: Use **Tasks** to represent planned intent, and **Commits** to represent executed, completed work.
- MUST: Automatically generate a commit when a task transitions to a terminal Done state.
- MUST: Allow manual commit logging for executed work that did not originate from a planned task.
- MUST: Keep commits immutable in their timestamp and completion integrity; edits are limited to message clarification and project tag reassignments.
- MUST: Support deterministic task weighting: Small = 1, Normal = 2, Major = 4, Milestone = 8.
- NEVER: Introduce gamification, XP, badges, motivational quotes, or confetti celebrations.

### Deterministic Metrics
- MUST: Calculate metrics using transparent, explainable formulas:
  - **Execution**: $\sum \text{completed task weights} + \sum \text{manual commit weights}$
  - **Velocity**: $\frac{\text{Execution}}{\text{Period in Days}}$
  - **Throughput**: $\frac{\text{Completed Tasks}}{\text{Period}}$
  - **Completion Ratio**: $\frac{\text{Completed Planned Tasks}}{\text{Total Planned Tasks}} \times 100\%$
  - **Cycle Time**: $\text{Median}(\text{completed\_at} - \text{started\_at})$
  - **Consistency**: $\frac{\text{Active Days (Days with } \ge 1 \text{ commit)}}{\text{Eligible Days}} \times 100\%$
- NEVER: Present an opaque, unexplained "Productivity Score" or algorithmic rating.
- NEVER: Implement employee-surveillance features (keystroke tracking, mouse jitter, hours-online rankings, or forced team leaderboards).
- NEVER: Introduce generative AI clutter (AI summaries, AI conversational sidebars, or automated task text generation).

---

## Visual Design: Flat AMOLED Product

### Dual Environment Split
- MUST: Separate marketing and product surfaces into two distinct visual environments:
  - **Public Marketing Surfaces:** Dark monochrome (`#050505` to `#1C1C1C`), editorial, technical, high-contrast, graphite materials.
  - **Logged-in Product Application:** AMOLED black (`#000000`), flat, calm, dense. Depth comes from 1px hairlines and small tonal steps only.
- NEVER: Use neumorphism (soft extruded or inset shadows) anywhere in the product.
- NEVER: Tint the product page grey or turn large regions white. Near-white inverse surfaces (`#F2F2EF`, black text) are reserved for focal elements: `+ COMMIT`, the Today execution instrument, the headline metric, the active nav item, tooltips and toasts.

### Flat Surface Hierarchy
- MUST: Use the classes in `styles/product.css`; never hand-roll surface styles:
  - **Page:** `#000000` body, tables, text rows, ledger rows, graph labels, separators. No surface.
  - **Panel (`.app-panel`):** Board columns, toolbars, metric panels (`#0A0A0A`, 1px `rgba(255,255,255,.08)` border).
  - **Card / Control (`.app-card`, `.app-btn`):** Task cards, buttons, toggles, menus (`#121212`, 1px `rgba(255,255,255,.14)` border; hover `#1A1A1A`).
  - **Field (`.app-field`, `.app-input`):** Inputs, selects, progress rails, segmented troughs (`#000000`, 1px `rgba(255,255,255,.14)` border; focus border `rgba(255,255,255,.45)`).
  - **Overlay (`.app-overlay`):** Dialogs, drawers, command palette, menus (`#0A0A0A` with a hairline).
- MUST: Pressed controls drop to the page colour (`#000`); no shadows, no lift.
- MUST: Product text uses `#F2F2EF` / `#9A9A96` / `#85857F` (all pass WCAG AA on every surface); on inverse surfaces use `#0A0A0A` / `#55554F`.
- NEVER: Add box-shadows, glows or inset shadows to separate surfaces; use a hairline.
- NEVER: Use bright colorful brand gradients.

---

## Data & Architecture

### Full-Stack Monolith Standards
- MUST: Maintain Next.js App Router as the single deployable application layer for MVP.
- MUST: Store all timestamps in UTC (`withTimezone: true`); convert to user timezone exclusively for display.
- MUST: Use Drizzle ORM with Neon PostgreSQL for all relational queries and metric aggregations.
- MUST: Validate all inputs (Server Actions, Route Handlers, Forms) using deterministic Zod schemas.
- MUST: Use optimistic local updates for Kanban board card drag-and-drop; rollback only if persistence fails.
- MUST: Route every product write through a Server Action in `app/(app)/actions.ts` (session, paid access, write budget, strict Zod schema) into `lib/mutations.ts`, which re-checks every referenced id with `assertWritable` (`lib/authz.ts`). Identity, workspace, author, timestamps and execution value come from the server, never the request.
- MUST: Scope every read query by the viewer's workspace ids; ids outside them behave like missing ids (404, never 403).
- MUST: Add a case to `scripts/authz-check.ts` for every new endpoint or object type (User A vs User B, outsider, viewer role).
- MUST: Index every foreign key column and bound every list query (`limit`).
- NEVER: Introduce distributed microservices, external queue brokers, or separate databases before usage demands it.

---

## Interactions

### Keyboard
- MUST: Full keyboard support per [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/)
- MUST: Visible, unobscured focus rings (`:focus-visible`; group with `:focus-within`); sticky/fixed elements never cover focus
- MUST: Manage focus (trap, move, return) per APG patterns
- NEVER: `outline: none` without visible focus replacement

### Targets & Input
- MUST: Hit target ≥24px (mobile ≥44px); if visual <24px, expand hit area
- MUST: Mobile `<input>` font-size ≥16px to prevent iOS zoom
- NEVER: Disable browser zoom (`user-scalable=no`, `maximum-scale=1`)
- MUST: `touch-action: manipulation` to prevent double-tap zoom
- SHOULD: Set `-webkit-tap-highlight-color` to match design

### Forms
- MUST: Hydration-safe inputs (no lost focus/value)
- NEVER: Block paste in `<input>`/`<textarea>`
- MUST: Loading buttons show spinner and keep original label
- MUST: Enter submits focused input; in `<textarea>`, ⌘/Ctrl+Enter submits
- MUST: Keep submit enabled until request starts; then disable with spinner
- MUST: Accept free text, validate after—don't block typing
- MUST: Allow incomplete form submission to surface validation
- MUST: Errors inline next to fields; on submit, focus first error
- MUST: `autocomplete` + meaningful `name`; correct `type` and `inputmode`
- SHOULD: Disable spellcheck for emails/codes/usernames
- SHOULD: Placeholders end with `…` and show example pattern
- MUST: Warn on unsaved changes before navigation
- MUST: Compatible with password managers & 2FA; allow pasting codes
- MUST: Trim values to handle text expansion trailing spaces
- MUST: No dead zones on checkboxes/radios; label+control share one hit target

### State & Navigation
- MUST: URL reflects state (deep-link filters/tabs/pagination/expanded panels)
- MUST: Back/Forward restores scroll position
- MUST: Links use `<a>`/`<Link>` for navigation (support Cmd/Ctrl/middle-click)
- NEVER: Use `<div onClick>` for navigation

### Feedback
- SHOULD: Optimistic UI; reconcile on response; on failure rollback or offer Undo
- MUST: Confirm destructive actions or provide Undo window
- MUST: Use polite `aria-live` for toasts/inline validation
- SHOULD: Ellipsis (`…`) for options opening follow-ups ("Rename…") and loading states ("Loading…")

### Touch & Drag
- MUST: Generous targets, clear affordances; avoid finicky interactions
- MUST: Delay first tooltip; subsequent peers instant
- MUST: `overscroll-behavior: contain` in modals/drawers
- SHOULD: When suppressing page rubber-band bounce, set `overscroll-behavior: none` on `<html>` inside `@media (pointer: fine)`; keep coarse-pointer page defaults for pull-to-refresh. Test hybrid touch devices: `pointer` describes the primary input, and `none` also disables scroll chaining and native swipe navigation
- MUST: During drag, disable text selection and set `inert` on dragged elements
- MUST: Drag/swipe/pinch/path gestures have a tap/click and keyboard alternative unless essential
- MUST: If it looks clickable, it must be clickable

### Autofocus
- SHOULD: Autofocus on desktop with single primary input; rarely on mobile

---

## Animation

- MUST: Honor `prefers-reduced-motion` (provide reduced variant or disable)
- SHOULD: Prefer CSS > Web Animations API > JS libraries
- MUST: Animate compositor-friendly props (`transform`, `opacity`) only
- NEVER: Animate layout props (`top`, `left`, `width`, `height`)
- NEVER: `transition: all`—list properties explicitly
- SHOULD: Animate only to clarify cause/effect or add deliberate delight
- SHOULD: Choose easing to match the change (size/distance/trigger)
- MUST: Animations interruptible and input-driven; autoplay only for muted, non-essential loops
- MUST: Autoplay motion >5s alongside other content has pause, stop, or hide controls
- MUST: Correct `transform-origin` (motion starts where it "physically" should)
- MUST: SVG transforms on `<g>` wrapper with `transform-box: fill-box`

---

## Layout

- SHOULD: Optical alignment; adjust ±1px when perception beats geometry
- MUST: Deliberate alignment to grid/baseline/edges—no accidental placement
- SHOULD: Balance icon/text lockups (weight/size/spacing/color)
- MUST: Verify mobile, laptop, ultra-wide (simulate ultra-wide at 50% zoom)
- MUST: Respect safe areas (`env(safe-area-inset-*)`)
- MUST: Avoid unwanted scrollbars; fix overflows
- SHOULD: Flex/grid over JS measurement for layout

---

## Content & Accessibility

- SHOULD: Inline help first; tooltips last resort
- MUST: Skeletons mirror final content to avoid layout shift
- MUST: `<title>` matches current context
- MUST: No dead ends; always offer next step/recovery
- MUST: Design empty/sparse/dense/error states
- SHOULD: Curly quotes (“ ”); avoid widows/orphans (`text-wrap: balance`)
- MUST: `font-variant-numeric: tabular-nums` for number comparisons
- MUST: Redundant status cues (not color-only); icons have text labels
- MUST: Accessible names exist even when visuals omit labels
- MUST: Use `…` character (not `...`)
- MUST: `scroll-margin-top` on headings; "Skip to content" link; hierarchical `<h1>`–`<h6>`
- MUST: Resilient to user-generated content (short/avg/very long)
- MUST: Locale-aware dates/times/numbers (`Intl.DateTimeFormat`, `Intl.NumberFormat`)
- SHOULD: `translate="no"` on brand names, code tokens, & identifiers to prevent garbled auto-translation
- MUST: Accurate `aria-label`; decorative elements `aria-hidden`
- MUST: Icon-only buttons have descriptive `aria-label`
- MUST: Prefer native semantics (`button`, `a`, `label`, `table`) before ARIA
- MUST: Media has captions/transcripts/descriptions as applicable; controls are keyboard-operable; decorative media hidden from assistive tech
- MUST: Non-breaking spaces: `10&nbsp;MB`, `⌘&nbsp;K`, brand names

---

## Content Handling

- MUST: Text containers handle long content (`truncate`, `line-clamp-*`, `break-words`)
- MUST: Flex children need `min-w-0` to allow truncation
- MUST: Handle empty states—no broken UI for empty strings/arrays

---

## Performance

- SHOULD: Test iOS Low Power Mode and macOS Safari
- MUST: Measure reliably (disable extensions that skew runtime)
- MUST: Track and minimize re-renders (React DevTools/React Scan)
- MUST: Profile with CPU/network throttling
- MUST: Batch layout reads/writes; avoid reflows/repaints
- MUST: Mutations (`POST`/`PATCH`/`DELETE`) target <500ms
- SHOULD: Prefer uncontrolled inputs; controlled inputs cheap per keystroke
- MUST: Virtualize large lists (>50 items)
- MUST: Preload above-fold images; lazy-load the rest
- MUST: Prevent CLS (explicit image dimensions)
- SHOULD: `<link rel="preconnect">` for CDN domains
- SHOULD: Critical fonts: `<link rel="preload" as="font">` with `font-display: swap`
- SHOULD: `<video autoplay muted loop playsinline>` over animated GIF; provide still/reduced-motion alternative
- SHOULD: Short non-essential loops include a Safari H.264 MP4 `<picture>` source, `prefers-reduced-motion` media condition, and still fallback

---

## Dark Mode & Theming

- MUST: `color-scheme: dark` on `<html>` for dark themes
- SHOULD: `<meta name="theme-color">` matches page background
- MUST: Native `<select>`: explicit `background-color` and `color` (Windows fix)

---

## Hydration

- MUST: Inputs with `value` need `onChange` (or use `defaultValue`)
- SHOULD: Guard date/time rendering against hydration mismatch

---

## Design

- SHOULD: Product: crisp edges via semi-transparent hairline borders, no shadows (marketing may use layered shadows on material renders)
- SHOULD: Nested radii: child ≤ parent; concentric
- SHOULD: Hue consistency: keep borders and text neutral against the monochrome background
- MUST: Accessible charts (color-blind-friendly palettes)
- MUST: Meet contrast—prefer [APCA](https://apcacontrast.com/) over WCAG 2
- MUST: Increase contrast on `:hover`/`:active`/`:focus`
- SHOULD: Match browser UI to bg
- SHOULD: Avoid dark color gradient banding (use background images when needed)

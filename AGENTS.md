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

## Visual Design & Neumorphic Restraint

### Dual Environment Split
- MUST: Separate marketing and product surfaces into two distinct visual environments:
  - **Public Marketing Surfaces:** Dark monochrome (`#050505` to `#1C1C1C`), editorial, technical, high-contrast, graphite materials.
  - **Logged-in Product Application:** Pale monochrome (`#D9D9D5` to `#DEDEDA`), restrained neumorphism, tactile, calm, dense.
- NEVER: Mix the two environments arbitrarily (e.g., do not turn half of the product interface black). Inverse dark cards in the product are reserved strictly for high-focus focal elements (e.g., active instruments or primary action triggers like `+ COMMIT`).

### Restrained Neumorphism Hierarchy
- MUST: Strictly adhere to depth levels:
  - **Level 0 (Flat):** Base body background (`#D9D9D5`), tables, text rows, graph labels, separators. No shadows.
  - **Level 1 (Slightly Raised):** Board columns, toolbars, metric panels (`#DEDEDA`, `box-shadow: var(--shadow-raised-sm)`).
  - **Level 2 (Raised Control):** Buttons, toggles, compact draggable cards (`#DEDEDA`, `box-shadow: var(--shadow-raised-lg)`).
  - **Level -1 (Inset):** Search inputs, form textareas, progress rails, selection troughs (`#D2D2CE`, `box-shadow: var(--shadow-inset-sm)`).
- MUST: Ensure pressed buttons physically depress into an inset state (`:active` -> `neu-inset-sm`).
- NEVER: Produce a "wall of inflated marshmallows." Neumorphism must remain architectural, restrained, and functional.
- NEVER: Use arbitrary inline shadows or bright colorful brand gradients.

---

## Data & Architecture

### Full-Stack Monolith Standards
- MUST: Maintain Next.js App Router as the single deployable application layer for MVP.
- MUST: Store all timestamps in UTC (`withTimezone: true`); convert to user timezone exclusively for display.
- MUST: Use Drizzle ORM with Neon PostgreSQL for all relational queries and metric aggregations.
- MUST: Validate all inputs (Server Actions, Route Handlers, Forms) using deterministic Zod schemas.
- MUST: Use optimistic local updates for Kanban board card drag-and-drop; rollback only if persistence fails.
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

- SHOULD: Layered shadows (ambient + direct)
- SHOULD: Crisp edges via semi-transparent borders + shadows
- SHOULD: Nested radii: child ≤ parent; concentric
- SHOULD: Hue consistency: tint borders/shadows/text toward bg hue
- MUST: Accessible charts (color-blind-friendly palettes)
- MUST: Meet contrast—prefer [APCA](https://apcacontrast.com/) over WCAG 2
- MUST: Increase contrast on `:hover`/`:active`/`:focus`
- SHOULD: Match browser UI to bg
- SHOULD: Avoid dark color gradient banding (use background images when needed)

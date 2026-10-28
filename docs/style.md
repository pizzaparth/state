# State — Visual UI/UX Style Guide

**Product:** State by Ksan Relay  
**Domain:** `state.ksanrelay.in`  
**Document:** Visual design system / style direction  
**Design split:** Dark external brand surfaces + light neumorphic application  
**Core character:** Quantitative, tactile, restrained, technical, premium, fast

---

# 1. Design Thesis

State should look like a **quantitative instrument**, not a conventional productivity application.

The visual language combines two related but deliberately different environments:

1. **Public / marketing environment**
   - extremely dark
   - high contrast
   - editorial
   - technical
   - premium
   - minimal
   - finance-adjacent
   - almost cinematic

2. **Logged-in product environment**
   - pale monochrome
   - soft neumorphism
   - tactile
   - sculpted
   - calm
   - dense enough for serious work
   - visually closer to an instrument panel than a SaaS dashboard

The two environments must still feel like the same brand.

The common language is:

- monochrome
- geometric layouts
- restrained typography
- large numerical information
- subtle borders
- precise spacing
- rounded superellipse-like geometry
- minimal iconography
- strong use of negative space
- no decorative colour noise
- no playful SaaS illustrations
- no gradient-heavy startup aesthetic

State should feel as if **Ksan Relay built an execution terminal for humans**.

---

# 2. Emotional Direction

The interface should communicate:

- precision
- calm
- control
- speed
- technical competence
- measurement
- seriousness
- confidence
- modernity
- tactility

It should **not** communicate:

- playfulness
- gamification
- lifestyle productivity
- wellness
- "AI magic"
- cartoon friendliness
- corporate enterprise bureaucracy
- crypto casino aesthetics
- generic startup SaaS

A useful visual description is:

> **Soft industrial minimalism for the product, black editorial minimalism for the brand.**

Another useful description:

> **A monochrome quantitative operating surface.**

---

# 3. Overall Brand Relationship

The marketing site and application are visually different but conceptually connected.

## Marketing

Think:

```text
BLACK
WHITE
TYPE
SPACE
LIGHT
MATERIAL
```

The marketing layer sells the concept.

It should feel selective and expensive.

## Product

Think:

```text
SURFACE
DEPTH
CONTROL
STATE
SIGNAL
MEASUREMENT
```

The product layer should disappear into use.

It should feel tactile without becoming ornamental.

---

# 4. Public Website Visual Language

The landing page, pricing page, authentication pages, legal/public pages, and product marketing surfaces should use a **dark monochrome theme by default**.

## Base impression

The website should initially read as nearly black.

Use large areas of:

```text
#050505
#080808
#0B0B0B
#101010
```

rather than a washed-out charcoal background.

The overall frame should feel closer to black hardware packaging, a trading tool landing page, or premium technical equipment than to a normal SaaS site.

---

# 5. Public Website Colour System

## Background

Primary:

```text
--bg-0: #050505;
--bg-1: #080808;
--bg-2: #0D0D0D;
```

## Elevated surfaces

```text
--surface-1: #111111;
--surface-2: #161616;
--surface-3: #1C1C1C;
```

## Borders

```text
--border-subtle: rgba(255,255,255,0.08);
--border-default: rgba(255,255,255,0.12);
--border-strong: rgba(255,255,255,0.20);
```

## Text

```text
--text-primary: #F4F4F2;
--text-secondary: #A9A9A6;
--text-tertiary: #6F6F6B;
--text-inverse: #0A0A0A;
```

## White CTA

```text
--action-primary: #F2F2EF;
--action-primary-text: #0A0A0A;
```

## Accent colour

State should **not require an accent colour**.

If one is ever used, it should act like a signal, not decoration.

Examples:

- muted electric green
- muted terminal amber
- desaturated icy blue

Only one accent should exist at a time.

Use it for:

- active metric signal
- selected graph cell
- important status
- tiny live indicator

Do not use accent colours for every category.

---

# 6. Public Website Contrast

The public site should derive visual richness from:

- material
- light
- typography
- shadows
- contrast
- texture

—not from colour.

Primary hierarchy:

```text
white
↓
soft white
↓
grey
↓
dark grey
↓
black
```

---

# 7. Public Website Typography

Typography should be one of the dominant visual elements.

## Character

Use a clean, modern grotesk or neo-grotesk.

Desired properties:

- geometric but not futuristic
- high legibility
- clean numerals
- excellent medium/bold weights
- neutral punctuation
- good tabular numeral support

Possible aesthetic references:

- Helvetica Neue
- Suisse
- Inter
- Geist
- Neue Haas Grotesk
- Söhne-like proportions

Do not use excessively stylised "tech" fonts.

## Hero type

Hero text should be:

- very large
- bold
- tightly tracked
- short
- left aligned by default
- approximately 2–4 lines maximum

Example:

```text
EXECUTION,
MEASURED.
```

or:

```text
TURN WORK
INTO SIGNAL.
```

The typography should itself behave like the primary graphic.

## Heading tracking

Large display text:

```text
letter-spacing: -0.04em to -0.02em
```

Small labels:

```text
letter-spacing: 0.08em to 0.16em
text-transform: uppercase
```

## Numeric type

Metrics should use:

- tabular numerals
- slightly tighter tracking
- optional monospace secondary face

Example:

```text
Execution      42.7
Velocity        6.1/d
Completion     87.3%
```

---

# 8. Public Website Layout

The public site should have strong alignment and obvious structure.

Prefer:

- one strong grid
- generous page margins
- wide desktop composition
- carefully controlled maximum width
- clean horizontal rhythm

Suggested desktop container:

```text
max-width: 1280–1440px
```

Suggested page side padding:

```text
48–80px desktop
24–32px tablet
18–24px mobile
```

Avoid excessive card nesting.

The page should feel composed, not assembled from components.

---

# 9. Navigation

The marketing navigation should be extremely restrained.

Typical structure:

```text
STATE

Product
Principles
Pricing
Ksan Relay

Sign in
Start
```

Characteristics:

- short
- thin
- low visual weight
- one compact primary button
- no giant floating navbar
- no colourful navigation states

A rounded black/grey pill navigation may be used if the border and blur remain subtle.

---

# 10. Landing Hero

The hero should feel immediate.

## Structure

Left:

- tiny technical eyebrow
- large statement
- one short description
- primary CTA

Right:

- abstract State object
- execution surface
- product render
- material blocks
- graph-inspired sculptural element

Example:

```text
KSAN RELAY / STATE

EXECUTION,
MEASURED.

A quantitative execution system for
tracking what was planned, what happened,
and how consistently you execute.

[ START STATE ]
```

## Hero visuals

Preferred:

- black 3D tiles
- metallic / graphite surface
- monochrome interface fragments
- softly lit abstract geometry
- physical-looking UI tokens
- subtle grain

Avoid:

- stock photos
- people smiling with laptops
- bright 3D blobs
- multi-colour gradients
- abstract AI-generated rainbow shapes

---

# 11. Dark Material Style

3D or material objects on the landing page should resemble:

- graphite
- anodised aluminium
- black rubber
- frosted glass
- dark ceramic
- matte polymer

Lighting:

- soft directional studio lighting
- edge highlights
- controlled reflections
- deep shadows
- low saturation

The material treatment should reinforce:

> instrument / terminal / engineered object

rather than:

> futuristic sci-fi gadget

---

# 12. Public Cards

Marketing cards can use dark glass / soft black surfaces.

Card properties:

```text
background: rgba(255,255,255,0.025)
border: 1px solid rgba(255,255,255,0.08)
border-radius: 20–28px
```

Optional:

```text
backdrop-filter: blur(18px)
```

But blur must never make the page look like generic glassmorphism.

The surface should still read as dark and solid.

---

# 13. Public Buttons

## Primary

Light button on dark background.

```text
background: #F1F1EE;
color: #090909;
```

Shape:

- pill or rounded rectangle
- medium height
- modest radius
- substantial horizontal padding

Recommended:

```text
height: 44–52px
border-radius: 14–999px
```

## Secondary

Dark surface with border.

```text
background: #111;
border: 1px solid rgba(255,255,255,.12);
color: #EAEAE7;
```

Do not use bright brand gradients.

---

# 14. Authentication UI

Authentication should remain within the dark marketing visual system.

## Page structure

- black background
- centered authentication panel
- sparse content
- thin border
- subtle edge glow
- strong typography
- high-control spacing

Panel:

```text
background: #0A0A0A to #101010
border: 1px solid rgba(255,255,255,.10)
border-radius: 28–36px
```

## Inputs

Inputs should be dark inset controls.

```text
background: #151515
border: 1px solid rgba(255,255,255,.10)
```

Focused:

```text
border: rgba(255,255,255,.40)
```

Avoid blue browser-style focus rings visually, but retain accessible focus indication.

## Sign-in button

White or near-white.

It should be visually decisive.

---

# 15. Pricing Page

Pricing should continue the dark aesthetic.

The page should feel premium and sparse.

## Cards

Cards:

- nearly black
- translucent highlights
- large radius
- faint inner reflection
- slight depth
- little colour
- strong price typography

Recommended arrangement:

- one or two plans only
- no permanent free plan
- highlighted plan via brightness, scale, or white CTA
- not via bright colours

Example:

```text
STATE
₹199 / month

ORGANISATION
₹299 / member / month
```

The paid nature of the product should feel intentional rather than aggressively monetised.

---

# 16. Logged-In Product Visual Language

The application itself should switch into a **light monochrome neumorphic environment**.

This is not classic exaggerated 2020-style neumorphism.

It should be:

- flatter
- cleaner
- more precise
- more architectural
- more usable
- less decorative

Use the term:

> **restrained neumorphism**

The UI should look physically moulded from a continuous pale material.

---

# 17. Product Base Surface

Primary product background:

```text
#D8D8D4
#DEDEDA
#E3E3DF
```

The exact tone can vary slightly by surface.

Avoid pure white as the application background.

The product needs enough mid-grey material for shadows and highlights to be visible.

---

# 18. Product Neumorphic Model

Every elevated object should use two opposing light cues:

1. a lighter highlight
2. a darker soft shadow

Example concept:

```css
box-shadow:
  -8px -8px 20px rgba(255,255,255,.70),
   8px  8px 20px rgba(0,0,0,.10);
```

For smaller controls:

```css
box-shadow:
  -3px -3px 8px rgba(255,255,255,.65),
   3px  3px 8px rgba(0,0,0,.10);
```

For inset controls:

```css
box-shadow:
  inset 3px 3px 8px rgba(0,0,0,.09),
  inset -3px -3px 8px rgba(255,255,255,.70);
```

These are visual starting points, not mandatory values.

---

# 19. Restraint Rule

Do not apply strong neumorphic shadows to every object.

Use depth levels.

## Level 0 — Flat

For:

- body background
- tables
- text rows
- graph labels
- separators

## Level 1 — Slightly raised

For:

- toolbar
- board column
- metric panel
- navigation item group

## Level 2 — Raised control

For:

- buttons
- toggles
- compact cards
- draggable task items

## Level -1 — Inset

For:

- search
- input fields
- selected troughs
- progress rails

The product should never resemble a wall of inflated marshmallows.

---

# 20. Product Colour System

## Application background

```text
--app-bg: #D9D9D5;
--app-bg-soft: #E1E1DD;
```

## Raised surfaces

```text
--surface-raised: #DEDEDA;
--surface-raised-light: #E6E6E2;
```

## Inset surfaces

```text
--surface-inset: #D2D2CE;
```

## Text

```text
--app-text-primary: #171717;
--app-text-secondary: #5F5F5B;
--app-text-tertiary: #8B8B86;
```

## Dark inverse surface

The application may use selective black cards to create hierarchy.

```text
--surface-inverse: #101010;
--surface-inverse-2: #171717;
--inverse-text: #F2F2EF;
```

Dark cards should be exceptional.

Use them for:

- selected project summary
- active instrument
- high-priority metric block
- focus surface

Do not turn half the application dark.

---

# 21. Product Shape Language

The interface should use generous rounded geometry.

Typical radii:

```text
small control     10–12px
input             14–18px
task              14–18px
card              20–26px
large module      28–36px
pill              999px
```

Prefer smooth superellipse-like corners where possible.

Avoid sharp 4px enterprise SaaS corners.

Avoid cartoonishly round bubbles.

---

# 22. Product Typography

The product should use the same primary type family as marketing.

Differences:

- smaller
- denser
- calmer
- numbers become more prominent
- uppercase technical labels appear more often

## Hierarchy

Page title:

```text
36–52px
600–700
tight tracking
```

Section title:

```text
18–24px
600
```

Body:

```text
14–16px
400–500
```

Metric value:

```text
28–48px
500–700
tabular numerals
```

Micro-label:

```text
10–12px
500–600
uppercase
letter-spacing: .08em–.14em
```

---

# 23. Product Navigation

The application should use a pale raised side rail or compact vertical navigation.

Possible structure:

```text
State

Today
Inbox

Execution
Activity
History
Metrics

Work
Personal
Organisation
Projects

Settings
```

Navigation characteristics:

- large soft container
- subtle embossing
- compact icons
- text labels
- selected item can invert to near-black

Selected item:

```text
background: #111
color: #F4F4F1
```

This provides a crisp focal point against the soft background.

---

# 24. Top Bar

The application top bar should be minimal.

It may include:

- current context
- date
- search
- command palette
- notifications
- workspace switcher
- profile

Individual controls can be small raised pills.

Avoid one huge full-width white navbar.

---

# 25. Buttons in Product

Three visual states:

## Raised primary light

For common non-destructive actions.

## Dark inverse

For strongest actions.

Example:

```text
+ COMMIT
```

## Inset / quiet

For secondary toggles.

Buttons should feel physically pressable.

Pressed state should become visually inset.

---

# 26. Inputs

Inputs should appear inset into the material.

Example visual:

```text
╭──────────────────────────╮
│ Add task…                │
╰──────────────────────────╯
```

No obvious white rectangular field pasted on a grey page.

Input states:

- resting: inset
- focus: slightly stronger inner border/shadow
- invalid: subtle semantic outline
- disabled: lower contrast

---

# 27. Cards

Cards should not all be independent floating rectangles.

The design should use a hierarchy of:

- parent surfaces
- internal sections
- flat rows
- embedded controls

Use cards only when they represent a meaningful object or grouping.

Good:

- project summary
- objective
- metric module
- selected commit detail

Bad:

- every label
- every statistic
- every tiny button

---

# 28. Kanban Board

The Kanban view should be highly usable and visually quieter than the marketing site.

## Columns

Columns should resemble softly raised trays.

```text
BACKLOG
ACTIVE
REVIEW
DONE
```

Column header:

- uppercase micro-label
- task count
- compact menu

## Tasks

Task cards should be slightly raised from the column.

Each task can display:

- title
- project
- due date
- priority mark
- weight
- assignee

Avoid colourful tag soup.

Use:

- typography
- icons
- greyscale chips
- tiny semantic indicators

Drag state:

- stronger shadow
- slight lift
- very small scale increase

Drop target:

- inset area

---

# 29. Commit History

Commit history should visually resemble a technical event stream.

Example:

```text
18:42   ●  Implemented temporal indexing
17:51   ●  Finished market microstructure notes
16:08   ●  Fixed auth middleware
14:21   ●  Reviewed PR #38
```

Use:

- aligned timestamps
- monospaced or tabular numerals
- thin connectors
- small circular markers
- low-noise rows

Do not render every commit as a giant card.

---

# 30. Execution Graph

The execution graph should be a signature component.

## Style

- horizontal
- monochrome
- embedded into a softly raised or inset surface
- tiny precise cells
- light-to-dark intensity scale

Possible intensity:

```text
0   #CCCCCA
1   #B7B7B3
2   #8D8D89
3   #595956
4   #191919
```

The darkest value should feel like a strong signal.

No GitHub green.

## Hover

Hover card may be a compact dark floating tooltip:

```text
28 OCT

12 commits
17 execution
4 projects
```

---

# 31. Charts and Quantitative Visuals

Charts should resemble research/market visualisation rather than a business dashboard.

Use:

- thin axes
- subdued grid
- small labels
- monochrome lines
- black primary series
- grey comparison series
- tabular numbers

Avoid:

- rainbow chart palettes
- thick bars
- cartoon data visualisation
- giant pie charts
- decorative area gradients

Preferred visualisations:

- line
- compact bar
- sparkline
- heatmap
- distribution
- cumulative execution
- cycle-time histogram
- small multiples where justified

---

# 32. Metrics Surface

Metrics are central to State.

They should look like measurements, not marketing KPIs.

Example:

```text
EXECUTION
241

30D VELOCITY
8.03 / day

MEDIAN CYCLE
1.8d

COMPLETION
81.4%
```

The numeric value should be the visual focal point.

Small explanatory labels may sit underneath.

---

# 33. Quant Theme

The quant theme should be implemented through **information architecture and visual precision**, not clichés.

Good quant signals:

- tabular numerals
- exact timestamps
- deltas
- distributions
- concise metrics
- compact charts
- status labels
- technical language
- state transitions
- historical series
- statistical notation where useful

Bad quant clichés:

- random candlestick charts
- dollar signs
- Wall Street imagery
- fake Bloomberg screens
- green/red everywhere
- fake stock tickers
- "alpha" jargon where it adds no meaning

State is quantitative because it measures execution.

---

# 34. Icons

Use one consistent icon family.

Properties:

- outline
- 1.5–2px stroke
- simple geometry
- compact
- neutral

Recommended size:

```text
16px
18px
20px
```

Avoid oversized 32px icons in normal product UI.

Icons should support text, not replace obvious text labels unnecessarily.

---

# 35. Separators

Prefer:

- spacing
- material changes
- tiny tonal differences

over visible borders everywhere.

Where lines are needed:

```text
rgba(0,0,0,.07)
```

for light UI.

Dark marketing:

```text
rgba(255,255,255,.08)
```

---

# 36. Shadows

Shadows are a major part of the product aesthetic.

They must remain broad and soft.

Avoid:

- sharp drop shadows
- black 30% box shadows
- large detached floating cards

Light environment:

```text
dark shadow: rgba(0,0,0,.08–.14)
light shadow: rgba(255,255,255,.55–.80)
```

Dark marketing environment:

```text
rgba(0,0,0,.35–.65)
```

with very subtle pale edge lighting.

---

# 37. Blur

Blur should be rare.

Use blur for:

- marketing glass cards
- modal backdrop
- subtle navigation background
- floating overlay

Do not blur the entire product surface.

The logged-in interface should feel material and solid.

---

# 38. Texture

Very subtle texture can improve the marketing page.

Possible:

- fine film grain
- barely visible noise
- graphite material noise
- low-contrast star-like specks only if extremely restrained

Do not use heavy texture in the application.

---

# 39. Motion Language

Motion should communicate physics and state.

Use:

- 120–220ms transitions
- ease-out for appearance
- soft spring for drag
- tiny press depth
- subtle shadow interpolation

Examples:

Task press:

```text
raised → inset
```

Task drag:

```text
resting → lifted → resting
```

Modal:

```text
opacity + 8px vertical transition
```

Avoid:

- bouncing
- elastic overshoot
- glowing trails
- large parallax
- long 3D animations inside the application

The marketing site may use limited scroll motion.

---

# 40. Hover Behaviour

Desktop hover should be quiet.

Examples:

- 2–4% brightness change
- slightly increased border contrast
- subtle shadow increase
- icon opacity transition

Do not move ordinary buttons several pixels on hover.

---

# 41. Loading States

Use restrained loading states.

Preferred:

- skeleton rows
- faint pulse
- tiny progress indicator

Avoid:

- branded loading movies
- large spinners
- playful copy

---

# 42. Empty States

Empty states should remain structural.

Example:

```text
NO COMMITS

Complete a task or record a manual commit
to begin your execution history.

[ CREATE COMMIT ]
```

No illustration is necessary.

---

# 43. Modals

Product modal:

- pale raised surface
- large radius
- strong surrounding depth
- dark text
- no giant header

Dark marketing/auth modal:

- black surface
- thin edge
- subtle glow

---

# 44. Toasts

Toasts should be compact.

Example:

```text
Task committed.
```

No confetti.

No emoji.

No giant success banner.

---

# 45. Semantic Colours

The core interface remains monochrome.

Semantic colours can exist when meaning requires them.

Use muted, low-saturation colours.

Examples:

```text
success: muted green
warning: muted amber
danger: muted red
info: cool grey-blue
```

Semantic colour should occupy very little screen area.

---

# 46. Error States

Error UI must remain clear despite the monochrome design.

Use:

- subtle muted red border
- concise message
- icon where useful

Do not rely on colour alone.

---

# 47. Dark Inverse Modules Inside Product

A limited number of black modules can be embedded inside the pale application.

This provides a visual bridge back to the Ksan Relay brand.

Good uses:

- selected metric panel
- active project
- compact execution summary
- focused command palette
- modal command interface

Example:

```text
┌──────────────────────┐
│ EXECUTION / 7D       │
│                      │
│ 67.4                 │
│ +8.2%                │
└──────────────────────┘
```

Dark panels should feel intentional and rare.

---

# 48. Command Palette

The command palette can be one of the strongest visual elements.

Recommended style:

- dark inverse floating panel
- centered
- strong blur behind
- monochrome results
- compact shortcut labels

This creates a sharp contrast against the light neumorphic product.

Example:

```text
> commit

Create commit
Open commit history
Filter commits
```

---

# 49. Responsive Product Behaviour

## Desktop

Primary experience.

Use:

- side navigation
- wide content
- dense board
- multi-column layout

## Tablet

Collapse side rail.

Use:

- drawer
- reduced board width
- horizontal board scrolling

## Mobile

Do not attempt to replicate desktop dashboard density.

Prioritise:

- Today
- quick capture
- task list
- commit
- history
- activity graph

Neumorphic depth should be reduced slightly on smaller screens.

---

# 50. Density

The interface should be visually soft but operationally dense.

This means:

- generous surface padding
- compact rows
- small controls
- clear typography
- few redundant labels

The product should not have the giant-card / giant-padding pattern common in marketing dashboards.

---

# 51. Spacing System

Use an 8px-based system.

Recommended tokens:

```text
4
8
12
16
24
32
40
48
64
80
96
```

Common values:

- icon gap: 8
- row gap: 8–12
- control padding: 12–16
- card padding: 20–28
- module gap: 16–24
- page section gap: 32–48

---

# 52. Accessibility Constraint on Neumorphism

Neumorphism must never reduce usability.

Critical rule:

> **Depth may be subtle; interaction state may not be ambiguous.**

Interactive elements need:

- readable text contrast
- visible focus
- obvious hit area
- distinguishable pressed state
- semantic labels
- keyboard navigation

Do not use shadow alone to communicate whether something is clickable.

Use shape, text, icons, placement, or subtle borders as necessary.

---

# 53. Accessibility Contrast

Main body text should meet normal accessibility contrast requirements.

Low-contrast grey may be used only for:

- supplementary metadata
- disabled states
- nonessential decoration

Important metrics and controls must remain high contrast.

---

# 54. Product Illustration Policy

The application should contain essentially no illustration.

Marketing may use:

- 3D product abstractions
- sculptural monochrome objects
- interface compositions

The application itself should use actual product UI.

---

# 55. Photography

Avoid photography as a dominant visual asset.

If photography ever appears:

- monochrome
- architectural
- material-focused
- abstract
- strongly art-directed

No corporate stock photography.

---

# 56. Landing Page Section Style

Recommended landing page progression:

```text
01 Hero
02 Execution Graph
03 Commit History
04 Metrics
05 Personal / Organisation
06 Principles
07 Pricing
08 Final CTA
```

Each section should have:

- one strong claim
- one visual
- minimal copy

Avoid repetitive three-card feature grids.

---

# 57. Landing Page Product Mockups

Mockups should not be shown inside fake browser chrome unless necessary.

Prefer:

- floating product slabs
- cropped UI instruments
- 3D-framed modules
- isolated metrics
- real interface sections

The visual should feel like a physical object under studio lighting.

---

# 58. Marketing Copy Presentation

Copy should be brief.

Good:

```text
YOUR WORK
HAS A HISTORY.
```

Bad:

```text
Unlock the power of next-generation productivity with
our revolutionary cutting-edge platform...
```

Description text should remain one or two short sentences.

---

# 59. Pricing Visual Hierarchy

Price:

- very large
- high contrast
- tabular
- minimal currency decoration

Example:

```text
₹199
/month
```

Features:

- short
- simple
- no dozens of checkmarks

CTA:

- white on black
- or black on near-white for selected card

---

# 60. Onboarding Visual Style

Onboarding belongs to the product, so it should use light neumorphism.

Keep it compact.

Do not create a ten-screen wizard.

Possible presentation:

```text
STATE

Create your first task.

[________________________________]
                         [ ADD ]
```

Then:

```text
Complete it.

Your first commit will be recorded.
```

---

# 61. Login-to-Product Transition

The visual shift from dark auth to pale product can be deliberate.

Sequence:

```text
black authentication
       ↓
successful sign in
       ↓
brief neutral transition
       ↓
pale State workspace
```

This creates the feeling of entering an instrument rather than staying on the marketing website.

---

# 62. Personal Board Visual Identity

Personal should feel calm and minimal.

It should not look like a collaborative enterprise tool.

Use:

- fewer controls
- larger whitespace
- simple columns
- personal execution graph nearby

---

# 63. Organisation Visual Identity

Organisation surfaces may become slightly denser.

Use:

- more data
- members
- project filters
- small metrics
- compact board controls

But retain the same material language.

Do not turn organisational UI into Jira.

---

# 64. Project Page

A project page can visually combine both material styles.

Example:

```text
PROJECT / RELAYDB

RelayDB

ACTIVE

Open tasks          14
Completed           37
7D commits          22
Execution rate      3.14/day

[ execution graph ]

[ recent commits ]

[ tasks ]
```

Use one dark inverse block if a strong focal area is needed.

---

# 65. Today View

Today should be the calmest surface in State.

It should feel like an instrument panel for the current day.

Suggested hierarchy:

```text
TODAY
28 OCT

7 / 11 EXECUTION

[ horizontal progress ]

ACTIVE
...

QUEUED
...

COMPLETED
...
```

Avoid a crowded analytics dashboard here.

---

# 66. Product Header Language

Product headers should use short technical labels.

Examples:

```text
TODAY
EXECUTION
HISTORY
METRICS
PROJECTS
PERSONAL
ORGANISATION
```

This creates consistency with quantitative tooling.

---

# 67. Status Language

Use status indicators sparingly.

Examples:

```text
ACTIVE
PAUSED
BLOCKED
DONE
AHEAD
ON TRACK
BEHIND
```

Prefer small caps / uppercase micro-labels.

---

# 68. Microcopy Tone

Visual style and copy style should reinforce each other.

Copy should be:

- short
- factual
- restrained
- specific

Good:

```text
3 tasks overdue.
```

Bad:

```text
Oops! Looks like you’ve got a few tasks waiting for you 😅
```

---

# 69. Sound

No sound by default.

If sound is ever added for interaction:

- opt-in
- extremely subtle
- mechanical
- short

But sound is not part of the MVP style.

---

# 70. Cursor and Interaction Detail

On desktop:

- pointer for buttons
- grab/grabbing for draggable tasks
- text cursor for editable content
- no custom novelty cursor

---

# 71. Scrollbars

Use subtle custom scrollbars only if browser support allows without compromising usability.

They should be:

- narrow
- grey
- unobtrusive

Board horizontal scrolling should remain obvious enough to discover.

---

# 72. Tables

If tables are needed:

- mostly flat
- row separators only
- dense
- aligned numbers
- no alternating rainbow fills
- sticky header where useful

Numeric columns:

- right-aligned
- tabular numerals

---

# 73. Tooltips

Tooltips should be dark even inside the light app.

This improves legibility and creates brand continuity.

Example:

```text
28 OCT
17 execution
12 commits
```

---

# 74. Dropdowns

Dropdowns:

- raised pale panel in light product
- strong soft shadow
- dark text
- compact row height

Command-like menus may instead use dark inverse styling.

---

# 75. Avatars

Avatars should be small.

Preferred:

- monochrome or desaturated where possible
- subtle circular frame
- 24–32px in dense UI

Do not make avatars visually dominant.

---

# 76. Tags

Tags should normally be greyscale.

Example:

```text
RESEARCH
BACKEND
PAPER
```

Style:

- small
- compact
- muted
- possibly inset

Semantic colour only if the tag itself has functional meaning.

---

# 77. Priority

Priority should not use giant coloured flags.

Suggested visual:

```text
P0
P1
P2
P3
```

or:

```text
CRITICAL
HIGH
NORMAL
LOW
```

Display in compact muted form.

---

# 78. Due Dates

Due dates should remain textual.

Example:

```text
28 OCT
Tomorrow
+2d overdue
```

Only overdue states need muted red emphasis.

---

# 79. Progress

Progress bars should appear inset into the surface.

Track:

- pale / grey inset groove

Fill:

- dark graphite

No colourful gradient.

---

# 80. Toggles

Toggles should feel physical.

Off:

- inset grey trough
- pale knob

On:

- dark trough
- pale knob

No bright blue default switch.

---

# 81. Checkbox

Checkboxes can be slightly inset.

Completed:

- filled dark
- light checkmark

This is one of the few places where full black can appear frequently.

---

# 82. Focus Ring

Focus ring should match the system.

Possible light-product focus:

```text
1px dark border
+
soft outer halo
```

Dark-marketing focus:

```text
1px white border
+
subtle white halo
```

Accessibility takes precedence over aesthetic minimalism.

---

# 83. Skeleton State

Skeletons should use the existing material.

Product:

- slightly darker/lighter bars within pale material

Marketing:

- charcoal shapes on black

No shimmering rainbow loading effect.

---

# 84. Mobile Marketing

The landing page should preserve its black editorial quality on mobile.

Hero:

- large type
- stacked
- one CTA
- 3D visual below

Do not shrink the desktop composition until it becomes unreadable.

---

# 85. Mobile Product

On mobile:

- reduce external shadows
- simplify layers
- make touch targets at least ~44px
- use bottom actions where useful
- prioritise lists over kanban columns

The product can remain neumorphic without sacrificing compactness.

---

# 86. Do / Don't

## Do

- use monochrome aggressively
- make typography carry hierarchy
- use precise numerical formatting
- use dark inverse surfaces selectively
- use broad, soft shadows
- use large smooth radii
- make controls tactile
- preserve information density
- make graphs feel analytical
- use real product screens in marketing
- maintain strict alignment
- make movement subtle
- use consistent tabular numerals

## Don't

- use rainbow gradients
- use colourful dashboards
- use neon fintech clichés
- copy GitHub green
- use excessive glassmorphism
- use excessive blur
- use strong shadows on everything
- use huge amounts of card nesting
- use cartoon icons
- use AI-style glowing purple effects
- use playful microcopy
- use gradients inside basic buttons
- use floating orbs as filler
- make the product look like Notion
- make the product look like Jira
- make neumorphism reduce contrast

---

# 87. Reference Translation

The supplied references translate into State as follows.

## Reference characteristic: pale sculpted UI

Adopt:

- grey material background
- twin-shadow depth
- rounded surfaces
- raised controls
- inset inputs
- tactile interactions

Do not copy:

- exact layout
- specific object arrangement
- music/media metaphors

## Reference characteristic: premium white project dashboard

Adopt:

- architectural spacing
- black inverse modules
- strong alignment
- product-as-object presentation
- large rounded modules

Do not copy:

- generic agency dashboard information architecture
- heavy use of decorative renders inside work surfaces

## Reference characteristic: black landing page

Adopt:

- near-black field
- oversized white typography
- sparse navigation
- dark material objects
- white CTA
- subdued supporting copy

## Reference characteristic: dark authentication

Adopt:

- centered black panel
- thin frame
- focused form hierarchy
- white primary action
- spacious inputs

## Reference characteristic: black pricing cards

Adopt:

- large price type
- dark glass/material cards
- muted border
- white CTA
- layered black depth

Do not include a permanent free plan.

---

# 88. State-Specific Visual Signature

State should develop three immediately recognisable signature elements.

## 88.1 Horizontal Execution Graph

A monochrome horizontal matrix that becomes the visual symbol of measured execution.

## 88.2 Commit Marker

A small filled circle / node representing a completed unit of work.

Potential icon:

```text
●
```

It should appear consistently in:

- commit history
- graphs
- activity timelines
- project summaries

## 88.3 State Surface

The logged-in app should use its pale sculpted material consistently enough that a cropped screenshot is recognisable as State.

---

# 89. Possible Logo Direction

The logo should remain extremely simple.

Potential concepts:

- state transition node
- two-state toggle abstraction
- concentric circle
- single execution point
- horizontal state change
- compact `S` built from two opposing curves

It should work in pure black and white.

Avoid finance clichés.

---

# 90. Design Keywords

Use these terms when briefing designers or generation tools:

```text
monochrome
restrained neumorphism
soft industrial
quantitative
editorial black
graphite
matte
tactile
instrument panel
high contrast
technical
tabular numerals
precision
superellipse
soft studio lighting
minimal
data-dense
calm
premium
architectural
```

Avoid these terms:

```text
playful
vibrant
colourful
friendly SaaS
AI gradient
cyberpunk
neon
gamified
cartoon
glass everywhere
```

---

# 91. One-Sentence Visual Brief

> **State uses a near-black, high-contrast editorial identity on the public website and a pale, restrained neumorphic instrument-panel aesthetic inside the product, unified by monochrome materials, precise typography, tabular data, soft physical depth, and quantitative information design.**

---

# 92. Short Designer Brief

If this guide must be reduced to a short brief:

```text
STATE / KSAN RELAY

MARKETING
Near-black.
Large white grotesk typography.
Sparse.
Premium technical hardware feel.
Graphite 3D material.
Thin borders.
White CTAs.
Dark authentication and pricing.
No bright colours.

PRODUCT
Pale warm-grey base.
Restrained neumorphism.
Soft opposing shadows.
Inset inputs.
Raised controls.
Large smooth radii.
Black inverse modules used sparingly.
Tabular numerals.
Monochrome execution graphs.
Compact technical labels.
Dense but calm.
No visual noise.

OVERALL
Quantitative instrument, not productivity SaaS.
No AI aesthetic.
No gradients.
No colourful dashboards.
No ads.
No gamification.
```

---

# 93. Final Design Rule

When deciding between two visual treatments, choose the one that makes State feel:

```text
more precise
more material
more measured
more restrained
less decorative
```

The visual system should support the product's central statement:

> **Execution, measured.**

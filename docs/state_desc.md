# Ksan Relay State

## Product Specification

**Product name:** State  
**Parent company:** Ksan Relay  
**Primary domain:** `state.ksanrelay.in`  
**Category:** Quantitative execution system  
**Business model:** Paid subscription only  
**Core positioning:** Execution, measured.  
**Product philosophy:** Fast, minimal, deterministic, measurable, and intentionally free of AI-generated clutter, advertising, feeds, and productivity theatre.

---

# 1. Product Summary

State is a quantitative execution system for individuals and organisations.

It combines:

- task management
- personal boards
- organisational boards
- kanban workflows
- a horizontal execution graph
- commit-style completion history
- project tracking
- execution metrics
- throughput analysis
- cycle-time analysis
- velocity tracking
- consistency measurement
- goal progress
- lightweight team execution visibility

State should not be marketed as a generic to-do application.

The product should instead be positioned as infrastructure for measuring and managing execution.

The central idea is:

> Tasks represent intent. Commits represent executed work. State measures the difference.

The conceptual lifecycle of work is:

```text
Intent → Execution → Commit → History → Measurement
```

State records what needs to happen, what happened, when it happened, and how execution changes over time.

---

# 2. Core Product Positioning

## Primary tagline

> Execution, measured.

## Product description

> State is a quantitative execution system that turns tasks, projects, and completed work into a measurable history of execution.

## Secondary descriptions

> A quantitative system for getting things done.

> Measure output, not busyness.

> Your work has a state. Track how it changes.

> A measurable execution layer for individuals and teams.

## What State is not

State is not:

- a generic to-do app
- a note-taking application
- a second-brain product
- a project-management suite
- an AI assistant
- an employee-surveillance product
- a Jira replacement
- a social productivity platform
- a habit-tracking app
- a calendar replacement

State should remain sharply focused on execution.

---

# 3. Product Principles

## 3.1 Execution over planning

State should optimise for completed work rather than elaborate planning.

Users should be able to capture tasks quickly, execute them, and record completed output with minimal friction.

## 3.2 Measurement over motivation

State should not use gamification-heavy motivation systems.

Avoid:

- badges
- XP systems
- confetti
- achievement spam
- artificial streak pressure
- motivational quotes
- fake productivity scores

Metrics should describe execution, not manipulate behaviour.

## 3.3 Deterministic over opaque

All calculations should be explainable.

If State displays:

- execution
- velocity
- completion rate
- cycle time
- consistency
- throughput

the user should be able to understand exactly how each value was calculated.

## 3.4 Fast over feature-heavy

State should feel immediate.

The product should prioritise:

- low latency
- keyboard navigation
- quick capture
- instant transitions
- minimal animation
- responsive drag-and-drop
- fast search
- instant board switching

## 3.5 Minimal over configurable

Avoid turning State into a configuration platform.

The application should provide sensible defaults.

## 3.6 No AI slop

State should launch without generative AI features.

No:

- AI summaries
- AI task generation
- AI suggestions
- AI prioritisation
- AI chat sidebar
- AI-written project plans
- AI-powered productivity recommendations
- AI-generated reports

If AI features are ever introduced, they must be optional, clearly useful, and never interfere with the deterministic core workflow.

## 3.7 No advertising

State should contain no ads.

No sponsored content.

No promoted integrations.

No paid placement inside the product.

Revenue comes from subscriptions.

---

# 4. Target Users

## 4.1 Individual users

Primary individual users:

- developers
- researchers
- engineers
- founders
- technical students
- quantitative researchers
- analysts
- independent creators
- highly structured knowledge workers

These users care about:

- output
- history
- consistency
- throughput
- measurable progress

## 4.2 Teams and organisations

Primary organisational users:

- research groups
- technical startups
- small engineering teams
- quantitative teams
- product teams
- student organisations
- independent labs
- small professional teams

State should initially optimise for small and medium-sized teams rather than enterprise bureaucracy.

---

# 5. Product Hierarchy

The product should use a small information architecture.

```text
STATE

Today

Execution
├── Activity
├── History
└── Metrics

Work
├── Inbox
├── Personal
├── Organisation
└── Projects

Settings
```

The left navigation should remain compact.

The user should rarely need more than one or two clicks to reach anything important.

---

# 6. Account Model

Every State account should contain:

- one user identity
- one personal workspace
- one personal board
- zero or more organisations
- zero or more projects
- tasks
- commits
- execution metrics
- subscription state
- user preferences

## Personal workspace

Every user automatically receives a private personal workspace.

This workspace cannot be deleted.

## Organisation workspaces

Users can:

- create organisations
- join organisations
- leave organisations
- invite members
- assign organisation roles
- create organisation projects
- create organisation boards

---

# 7. Core Data Objects

State should be built around a small number of first-class objects.

## 7.1 User

Fields:

- `id`
- `name`
- `email`
- `avatar`
- `timezone`
- `created_at`
- `updated_at`
- `subscription_status`
- `subscription_plan`
- `theme`
- `default_workspace`

## 7.2 Workspace

Workspace types:

- personal
- organisation

Fields:

- `id`
- `name`
- `slug`
- `type`
- `owner_id`
- `created_at`
- `updated_at`

## 7.3 Organisation

Fields:

- `id`
- `workspace_id`
- `name`
- `slug`
- `logo`
- `description`
- `created_at`
- `updated_at`

## 7.4 Organisation member

Fields:

- `organisation_id`
- `user_id`
- `role`
- `joined_at`

Roles:

- owner
- admin
- member

Optional later:

- viewer

## 7.5 Board

Fields:

- `id`
- `workspace_id`
- `project_id`
- `name`
- `type`
- `created_at`
- `updated_at`

Board types:

- personal
- organisation
- project

## 7.6 Column

Fields:

- `id`
- `board_id`
- `name`
- `position`
- `state_type`

Default personal columns (the first is labelled Queued; its `state_type` is `backlog`):

- Queued
- Active
- Done

Default organisational columns may be:

- Queued
- Active
- Review
- Done

Custom columns can be added later.

## 7.7 Project

Fields:

- `id`
- `workspace_id`
- `name`
- `slug`
- `description`
- `status`
- `created_at`
- `updated_at`
- `archived_at`

Project statuses:

- planned
- active
- paused
- completed
- archived

## 7.8 Task

Fields:

- `id`
- `workspace_id`
- `project_id`
- `board_id`
- `column_id`
- `assignee_id`
- `creator_id`
- `title`
- `description`
- `priority`
- `weight`
- `due_at`
- `started_at`
- `completed_at`
- `created_at`
- `updated_at`
- `archived_at`

## 7.9 Commit

A commit is the canonical record of completed work.

Fields:

- `id`
- `workspace_id`
- `project_id`
- `task_id`
- `user_id`
- `message`
- `execution_value`
- `created_at`
- `source`

Commit sources:

- task completion
- manual commit
- imported event
- integration

## 7.10 Tag

Fields:

- `id`
- `workspace_id`
- `name`

## 7.11 Task tag

Fields:

- `task_id`
- `tag_id`

## 7.12 Metric snapshot

Fields:

- `id`
- `workspace_id`
- `user_id`
- `metric_type`
- `period`
- `value`
- `recorded_at`

---

# 8. Tasks

Tasks represent planned work.

## Required functionality

Users must be able to:

- create tasks
- edit tasks
- delete tasks
- archive tasks
- complete tasks
- reopen tasks
- move tasks between columns
- assign tasks
- attach tasks to projects
- add due dates
- add priority
- add execution weight
- add tags
- search tasks
- filter tasks

## Minimal task creation

Creating a task should require only:

- title

Everything else should be optional.

## Task detail view

A task detail panel should display:

- title
- description
- project
- board
- current state
- assignee
- creator
- priority
- weight
- due date
- creation time
- start time
- completion time
- tags
- linked commit
- activity history

---

# 9. Inbox

Inbox exists for rapid capture.

The Inbox should allow a user to create a task without deciding where it belongs.

## Behaviour

A user enters:

```text
Implement authentication
```

State immediately stores it.

The user can later move it to:

- personal board
- project
- organisation board

## Quick parser

State may support deterministic text parsing.

Example:

```text
implement authentication tomorrow #state
```

Parsed as:

```text
Task: Implement authentication
Due: Tomorrow
Project: State
```

Potential syntax:

```text
#project
@person
!high
tomorrow
fri
2026-10-30
```

No language model should be required.

---

# 10. Personal Board

Every account receives one default personal board.

Default structure:

```text
BACKLOG       ACTIVE       DONE
```

Users may drag tasks horizontally.

The board should be intentionally simple.

## Features

- drag-and-drop
- keyboard movement
- task counts
- filters
- project labels
- due-date indicators
- priority indicators
- completion transitions

No unnecessary board automations at launch.

---

# 11. Organisation Board

Organisation boards support team execution.

Example:

```text
BACKLOG → ACTIVE → REVIEW → DONE
```

## Organisation board functionality

- create tasks
- assign members
- move tasks
- track project state
- inspect commit history
- filter by person
- filter by project
- filter by status
- view organisation execution graph
- inspect organisation metrics

## Important product principle

State must not become employee-surveillance software.

Avoid:

- hours-online rankings
- keystroke metrics
- mouse activity
- hidden monitoring
- employee productivity scoring
- forced leaderboards

Organisation metrics should focus primarily on:

- project throughput
- completion
- cycle time
- workload
- delivery history

---

# 12. Projects

Projects group related work.

Examples:

```text
RelayDB
State
Ksan Relay Website
Research Paper 03
University
Personal
```

## Project page

Each project should contain:

- project name
- description
- status
- board
- tasks
- execution graph
- commit history
- metrics
- members
- tags

## Project header metrics

Example:

```text
Status              ACTIVE
Open tasks          14
Completed           37
7-day commits       22
Execution rate      3.14/day
```

---

# 13. Commits

Commits are one of the product's defining concepts.

Completing meaningful work generates a commit.

Example:

```text
COMMIT

Implemented temporal indexing

Project
RelayDB

Type
Development

Execution
+3

28 Oct 2026 · 18:42
```

## Automatic commits

When a task reaches a terminal completed state, State should create a commit automatically.

## Manual commits

Users should also be able to create commits without creating a task first.

Examples:

```text
Read chapter 7 of OS
Finished research notes
Completed workout
Deployed website
Reviewed pull request
```

This is useful because executed work does not always originate as a planned task.

## Commit properties

A commit should contain:

- message
- user
- timestamp
- project
- workspace
- optional task
- execution value
- source
- tags

## Commit immutability

Commit edits should be limited.

Recommended behaviour:

- message can be corrected
- project can be reassigned
- tags can be changed
- deletion should require explicit confirmation

The commit timestamp should preserve the original event time.

---

# 14. Commit History

State should maintain an execution ledger.

Example:

```text
TODAY

18:42  ● Implemented temporal indexing
17:51  ● Finished market microstructure notes
16:08  ● Fixed auth middleware
14:21  ● Reviewed PR #38

YESTERDAY

23:14  ● Completed DBMS revision
21:07  ● Published documentation
```

## History filters

Users should be able to filter by:

- all
- personal
- organisation
- project
- category
- tag
- date
- user

## Commit detail

Clicking a commit should reveal:

- commit message
- linked task
- linked project
- linked workspace
- completion timestamp
- task creation timestamp
- task start timestamp
- active duration
- execution value
- tags
- notes

---

# 15. Horizontal Execution Graph

The horizontal execution graph is a defining visual element of State.

It should resemble the information density of a contribution graph while remaining visually distinct.

## Graph concept

Each cell represents one day.

Cell intensity reflects execution volume.

Example:

```text
LAST 90 DAYS

Sep                         Oct
□ □ ░ ░ ■ ■ ■ ░ □ ■ ■ ■ ■ ■ ■
░ ■ ■ ■ ■ ░ ■ ■ ■ ■ ■ ■ ■ ░ ■
■ ■ ░ ■ ■ ■ ■ ■ ■ ■ ░ ■ ■ ■ ■
```

## Hover state

Example:

```text
October 28

12 commits
9 tasks completed
17 execution
4 projects touched
```

## Time ranges

Supported ranges:

- 30 days
- 90 days
- 6 months
- 1 year
- all time

## Contexts

Execution graph should exist for:

- individual account
- personal workspace
- organisation
- project
- individual organisation member

## Terminology

Preferred:

- Execution Graph

Alternative:

- Activity Matrix

Avoid:

- streak graph
- hustle graph
- productivity heatmap

---

# 16. Today View

Today should be the application's default working surface.

Example:

```text
TODAY

28 OCT

Execution today          7

ACTIVE
□ Implement caching
□ Finish OS chapter
□ Review design

QUEUED
□ Research paper
□ Update documentation

COMPLETED
■ API schema
■ Database migration
■ Landing page
```

## Today functionality

Today should display:

- date
- execution completed
- active tasks
- queued tasks
- overdue tasks
- completed tasks
- today's commits
- quick add
- quick commit

## Philosophy

Today should not become a dashboard full of widgets.

It is a work surface.

---

# 17. Execution Metric

Execution represents weighted completed work.

The metric must be transparent.

Example default weighting:

```text
Small task       1
Normal task      2
Major task       4
Milestone        8
```

Users may later customise weights.

## Formula

```text
Execution = Σ completed task weights + manual commit weights
```

## Example

```text
Tasks completed       8
Execution             17
Completion rate       72%
```

Avoid presenting an arbitrary opaque score such as:

```text
Productivity Score: 87
```

---

# 18. Velocity

Velocity measures execution over time.

Example:

```text
7D VELOCITY

Mon    8
Tue   12
Wed    4
Thu   16
Fri   11
Sat    7
Sun   10

Mean = 9.7 execution/day
```

## Formula

```text
Velocity = execution / time period
```

Supported periods:

- day
- 7 days
- 30 days
- custom range

---

# 19. Throughput

Throughput measures completed items over time.

Formula:

```text
Throughput = completed tasks / selected period
```

Examples:

- 4.1 tasks/day
- 23 tasks/week
- 88 tasks/month

---

# 20. Completion Ratio

Completion ratio measures completed planned work.

Formula:

```text
Completion Ratio = completed planned tasks / planned tasks
```

Example:

```text
81.4%
```

The period should always be shown.

---

# 21. Cycle Time

Cycle time measures how long work spends between active and complete states.

Formula:

```text
Cycle Time = completed_at - started_at
```

Recommended display:

- median
- average
- 75th percentile
- trend

Primary default should be median, because task duration distributions can be skewed.

---

# 22. Consistency

Consistency should describe regular execution without turning into streak pressure.

Possible transparent formulation:

```text
Consistency = active days / eligible days
```

Example:

```text
27 active days / 30 days
90%
```

Do not hide the calculation.

---

# 23. Metrics View

The metrics page should be compact and information-dense.

Example:

```text
METRICS / 30D

Execution             241
Tasks completed       138
Completion rate       81.4%
Median cycle time     1.8d
Active days           27/30
```

## Core metrics

- total execution
- tasks completed
- commits
- completion rate
- median cycle time
- average cycle time
- throughput
- velocity
- consistency
- active days
- project distribution

## Project distribution example

```text
RelayDB        41%
University     28%
Ksan Relay     19%
Personal       12%
```

---

# 24. Objectives

State may support higher-level objectives.

Instead of generic motivational goals, objectives should be represented as measurable positions.

Example:

```text
OBJECTIVE

Learn Machine Learning

Current state
17 / 42 modules

Target
42 modules

Deadline
31 Dec

Velocity
0.84 modules/day

Required velocity
0.66 modules/day

STATUS
AHEAD
```

## Objective fields

- name
- current value
- target value
- unit
- deadline
- linked projects
- linked tasks
- current velocity
- required velocity
- projected completion date
- status

Statuses:

- ahead
- on track
- behind
- completed

---

# 25. Command Palette

State should be keyboard-first.

Shortcut:

```text
⌘ K
```

or:

```text
Ctrl K
```

## Command examples

```text
new task
commit
open relaydb
move task
search
today
open project
switch workspace
```

## Keyboard shortcuts

Suggested:

```text
N        New task
C        New commit
B        Boards
G A      Activity
G H      History
G M      Metrics
G T      Today
/        Search
⌘ K      Command palette
```

Shortcuts should be discoverable in the UI.

---

# 26. Search

Global search should search:

- tasks
- commits
- projects
- organisations
- members
- tags

Search should feel instant.

Potential command:

```text
/
```

Search filters:

```text
type:
project:
user:
tag:
status:
before:
after:
```

Example:

```text
project:relaydb type:commit after:2026-10-01
```

---

# 27. Notifications

Notifications should be minimal.

Useful notifications:

- task assigned
- task mentioned
- organisation invitation
- approaching due date
- overdue task
- project status changed

Avoid noisy notifications.

Users should be able to configure:

- in-app
- email
- none

Potential later:

- push notifications

---

# 28. Recurring Tasks

Paid product functionality should include recurring tasks.

Recurrence examples:

- daily
- weekdays
- weekly
- monthly
- custom interval

When a recurring task is completed:

1. create commit
2. create next occurrence

Recurring tasks should not clutter commit history with future instances.

---

# 29. Dependencies

Optional advanced functionality.

A task may depend on another task.

Example:

```text
Deploy API
blocked by
Finish authentication
```

States:

- blocked
- available

State should not introduce full project-scheduling complexity.

---

# 30. Filters

Boards, history, projects, and metrics should support filters.

Common filters:

- user
- project
- tag
- status
- date
- priority
- workspace
- execution weight

Filters should be shareable later via URL query parameters.

---

# 31. Sorting

Tasks may be sorted by:

- manual order
- due date
- priority
- creation date
- execution weight

History should default to reverse chronological order.

---

# 32. Priorities

Recommended priority model:

```text
None
Low
Medium
High
Critical
```

Priority should remain visually restrained.

Avoid large coloured labels everywhere.

---

# 33. Task Weights

Default weights:

```text
Small       1
Normal      2
Major       4
Milestone   8
```

The UI should display both label and numeric value when needed.

Each level is roughly double the one below. Weights are relative effort, chosen by the person doing the work; nothing infers or adjusts them. The rubric shown wherever a weight is chosen (`lib/weights.ts`):

```text
Small       1   A quick, contained change. Under about an hour, no planning needed.
Normal      2   A typical piece of work, a few hours. Pick this when unsure.
Major       4   About twice a normal piece of work. A day or more, several steps.
Milestone   8   A finished outcome, not a step: a release or a shipped feature.
```

Guidance for choosing:

- compare against your own past work rather than counting hours
- consistency matters more than precision; the number is for comparing your own periods
- do not round up: the scale doubles, so inflation compounds
- a completed task's weight is fixed by its commit and cannot be changed afterwards

Users should be able to keep the default system without configuring anything.

Organisation-specific custom weight schemes can be added later.

---

# 34. Themes and Visual Design

## Primary aesthetic

Ksan Relay visual language should carry into State.

Primary palette:

- black
- white
- grey

Optional single accent signal colour.

## Typography

Use:

- clean grotesk or neo-grotesk for UI
- monospace for numbers, metrics, IDs, or commits where appropriate

## Numerical typography

All metric displays should use tabular numerals.

Example:

```text
Execution       42.7
Velocity         6.1/d
Completion      87.3%
```

## Visual references

The product may evoke qualities associated with:

- Linear
- GitHub
- terminal tooling
- research software
- trading interfaces

But it should not imitate any specific product.

## UI density

The product should be:

- dense enough for technical users
- minimal enough to remain readable
- free of decorative cards
- free of excessive gradients
- free of oversized empty spaces
- free of dashboard clutter

---

# 35. Motion

Animations should be restrained.

Permitted:

- subtle drag movement
- short panel transitions
- hover changes
- completion state transitions

Avoid:

- bounce effects
- confetti
- long page transitions
- decorative loading animations

---

# 36. Responsive Behaviour

State should launch as a responsive web application.

Priority:

1. desktop
2. tablet
3. mobile web

Desktop is the primary experience.

Mobile should support:

- Today
- quick task capture
- quick commit
- task completion
- history
- basic boards

Complex organisation board workflows may remain desktop-first.

---

# 37. Authentication

Supported authentication at launch:

- email + password
- magic link

Potential later:

- Google
- GitHub

Security requirements:

- hashed passwords
- secure sessions
- CSRF protection
- rate limiting
- email verification
- password reset
- secure cookies
- optional 2FA later

---

# 38. Onboarding

Onboarding should be minimal.

## Step 1

Create account.

## Step 2

Choose:

```text
Personal
Personal + Organisation
```

## Step 3

Create first task.

## Step 4

Complete first task.

State can then demonstrate:

```text
Your first commit has been recorded.
```

This immediately teaches the product concept.

Avoid lengthy onboarding questionnaires.

---

# 39. Subscription Model

State has no free plan.

The product is paid-only.

## Subscription requirement

Users must have an active subscription after any trial period in order to continue using State.

## Recommended approach

Offer a short free trial rather than a permanently free tier.

Suggested:

```text
14-day trial
No ads
Full functionality
No permanent free plan
```

A trial is optional from a product-policy perspective.

If Ksan Relay wants a hard paid wall from day one, State can instead require payment before workspace creation.

## Recommended plans

### State Individual

For one person.

Includes:

- personal workspace
- personal board
- unlimited tasks
- unlimited commits
- unlimited projects
- execution graph
- commit history
- metrics
- recurring tasks
- objectives
- advanced filters
- export
- API access when available

Suggested launch pricing:

```text
₹199/month
₹1,990/year
```

International equivalent can be priced separately.

### State Organisation

Per-member subscription.

Includes:

- everything in Individual
- organisations
- organisation boards
- member management
- shared projects
- task assignment
- organisation commit history
- organisation execution graph
- team metrics
- roles
- organisation-level filters

Suggested launch pricing:

```text
₹299/member/month
```

Potential annual discount:

```text
₹2,990/member/year
```

These prices are product recommendations, not fixed requirements.

## Billing principles

- no ads
- no artificial feature degradation
- transparent prices
- easy cancellation
- export available before account closure
- no dark patterns
- no mandatory annual contract for individuals

---

# 40. Billing States

Possible subscription states:

- trialing
- active
- past_due
- canceled
- expired

## Past-due behaviour

Recommended:

- allow read-only access temporarily
- block new task creation after grace period
- preserve all data

## Cancelled behaviour

After paid access ends:

- account enters read-only mode
- user may export data
- data remains available for a defined retention period
- organisation owners may transfer ownership before closure

---

# 41. Data Export

Users should be able to export their data.

Supported formats:

- CSV
- JSON

Exports should include:

- tasks
- commits
- projects
- tags
- metrics
- organisation membership where appropriate

This is important for product trust.

---

# 42. API

A public API can be added after launch.

Potential resources:

```text
/tasks
/commits
/projects
/workspaces
/organisations
/metrics
```

API authentication:

- personal API token
- OAuth later

Potential use cases:

- CLI tooling
- Git integrations
- automated commits
- internal dashboards
- external scripts

---

# 43. Integrations

Integrations should remain deliberate.

Potential future integrations:

- GitHub
- GitLab
- Linear
- Slack
- Discord
- calendar services
- email
- webhook endpoints

## GitHub integration idea

A GitHub merge or commit may optionally create a State commit.

This should never happen automatically without explicit user configuration.

---

# 44. CLI

A CLI would fit the product identity well.

Potential commands:

```bash
state task add "Implement caching"
state task list
state commit "Implemented caching"
state today
state metrics
state project open relaydb
```

Potential command:

```bash
state commit -p relaydb -w 4 "Implemented temporal index"
```

CLI authentication can use API tokens.

---

# 45. Offline Behaviour

State should support resilient operation during temporary connectivity loss.

At minimum:

- optimistic UI
- local queue for task changes
- local cache
- retry failed writes

Potential future:

- full offline-first mode

Conflict resolution should prefer deterministic rules and explicit conflict UI.

---

# 46. Performance Targets

State should feel immediate.

Recommended frontend performance targets:

- app shell load under 2 seconds on good broadband
- common navigation under 100 ms perceived latency
- task creation appears instantly
- drag-and-drop at 60 FPS
- board loads remain usable with thousands of tasks
- search results begin rendering within 200 ms when locally indexed
- API p95 latency below 300 ms for ordinary operations

These are product targets rather than contractual SLAs.

---

# 47. Reliability

Important data must not disappear.

Recommended principles:

- transactional writes
- regular backups
- restore testing
- idempotent commit creation
- retry-safe APIs
- audit events for destructive operations
- soft deletion before permanent deletion

---

# 48. Privacy

State should collect only data needed to operate the service.

Avoid:

- behavioural ad tracking
- selling user data
- hidden productivity surveillance
- third-party advertising profiles

Analytics should be privacy-conscious.

Product analytics may measure:

- feature adoption
- crash frequency
- latency
- retention
- conversion
- errors

Do not collect detailed task content for marketing analytics.

---

# 49. Security

Baseline security requirements:

- HTTPS everywhere
- encrypted transport
- encrypted database storage where supported
- password hashing using modern algorithms
- secure session cookies
- rate limits
- audit logging for sensitive actions
- protected billing webhooks
- organisation permission checks
- server-side authorization
- regular dependency updates

Potential later:

- SSO
- SCIM
- enterprise audit logs
- 2FA
- security keys

---

# 50. Audit Events

Organisation audit logs may include:

- member invited
- member removed
- role changed
- project created
- project archived
- task deleted
- organisation settings changed

Audit logs are operational security records.

They should not become employee activity surveillance.

---

# 51. Error Handling

Errors should be precise.

Good:

```text
Could not save task.
Your change is still stored locally.
Retrying automatically.
```

Bad:

```text
Oops! Something went wrong 🤪
```

The tone should remain technical and restrained.

---

# 52. Empty States

Empty states should teach functionality briefly.

Example:

```text
No commits yet.

Complete a task or create a manual commit to begin your execution history.
```

Avoid illustrations unless they materially improve clarity.

---

# 53. Product Language

State should use technical, restrained terminology.

Preferred vocabulary:

| Generic productivity term | State terminology |
|---|---|
| Productivity | Execution |
| Completed task | Commit |
| Stats | Metrics |
| Productivity trend | Velocity |
| Tasks/week | Throughput |
| Time to finish | Cycle time |
| Streak | Consistency |
| Goal progress | Position |
| Timeline | History |
| Workspace | Workspace / Organisation |
| Heatmap | Execution Graph |

---

# 54. Landing Page

## Hero

```text
Execution, measured.

State is a quantitative execution system for managing work, tracking output, and understanding how consistently you get things done.
```

Primary CTA:

```text
Start trial
```

or, if there is no trial:

```text
Subscribe
```

Secondary CTA:

```text
View product
```

## Hero visual

The hero should show the horizontal execution graph.

## Section 2

Headline:

```text
Your work has a history.
```

Description:

```text
Every completed task becomes part of your execution record.
```

Show commit history.

## Section 3

Headline:

```text
Measure throughput, not busyness.
```

Show:

- execution
- velocity
- cycle time
- completion
- consistency

## Section 4

Headline:

```text
Personal or organisational.
```

Show:

- personal board
- organisation board

## Section 5

Headline:

```text
No ads. No AI noise.
```

Explain the philosophy.

## Pricing section

Show paid plans only.

There should be no "Free" column.

---

# 55. Philosophy Page

Suggested copy:

```text
State is intentionally boring.

No advertisements.

No algorithmic feed.

No generative AI pasted into every screen.

No productivity theatre.

No infinite configuration.

State records what needs to happen,
what happened,
and how consistently you execute.
```

---

# 56. Brand Architecture

Ksan Relay product family:

```text
Ksan Relay
│
├── RelayDB
│   Quantitative temporal database
│
├── State
│   Quantitative execution system
│   state.ksanrelay.in
│
├── Analyse
│   Quantitative analysis platform
│
└── Research
    Papers, models, datasets, and libraries
```

State fits the Ksan Relay portfolio because its conceptual foundation is measurement and system state.

---

# 57. Homepage Example

```text
STATE

28 OCTOBER 2026

─────────────────────────────────────────────

Execution                     7 / 11

■■■■■■■■■■■■■■■■■■■■■■■□□□□□□

─────────────────────────────────────────────

ACTIVITY

Oct
     Mon  □ ■ ■ ■ ■ □ ■ ■ ■ ■ ■
     Tue  ■ ■ ■ □ ■ ■ ■ ■ ■ ■ ■
     Wed  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■
     Thu  ■ □ ■ ■ ■ ■ ■ ■ ■ ■ ■
     Fri  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■

─────────────────────────────────────────────

ACTIVE

[ ] Finish RelayDB query parser
[ ] Review paper
[ ] Implement authentication

─────────────────────────────────────────────

RECENT COMMITS

18:42   Finished database schema
17:51   Completed paper notes
15:32   Closed website issue
```

---

# 58. Organisation Example

```text
KSAN RELAY

RESEARCH      ENGINEERING      REVIEW      COMPLETE
```

Organisation summary:

```text
Execution       184
Commits          73
Projects          6
Median cycle    1.4d
```

Member contribution visibility may be available, but should be contextual rather than competitive.

Example:

```text
Parth        31 execution
Aarav        17 execution
Ishita       23 execution
```

Do not display this as a leaderboard by default.

---

# 59. Project Example

```text
RELAYDB

Status                ACTIVE
Open tasks             14
Completed              37
7-day commits          22
Execution rate         3.14/day

ACTIVITY
■■□■■■■■■■■□■■■■■■

RECENT COMMITS
Implemented temporal indexing
Optimised vector execution
Added as-of join tests
```

---

# 60. URL Structure

Suggested routes:

```text
/
 /today
 /inbox
 /activity
 /history
 /metrics
 /projects
 /projects/:projectSlug
 /personal
 /org/:orgSlug
 /org/:orgSlug/board
 /org/:orgSlug/projects
 /org/:orgSlug/members
 /org/:orgSlug/metrics
 /settings
 /settings/account
 /settings/billing
 /settings/preferences
```

---

# 61. Suggested Backend Entities

Potential relational model:

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
objective_links
subscriptions
audit_events
notifications
metric_snapshots
```

A relational database is a natural fit.

PostgreSQL would be a strong default backend datastore.

---

# 62. Suggested Architecture

One possible launch architecture:

```text
Frontend
React / Next.js

Backend
Go, Rust, or another strongly typed backend service

Database
PostgreSQL

Cache
Redis if needed

Object storage
S3-compatible storage

Authentication
First-party auth or managed auth provider

Billing
Stripe or another supported payment provider

Hosting
Cloud infrastructure with global CDN
```

The architecture should remain simpler than the product ambitions.

Avoid premature distributed systems.

---

# 63. Event Model

Important product events:

```text
task.created
task.updated
task.started
task.completed
task.reopened
task.deleted

commit.created
commit.updated
commit.deleted

project.created
project.updated
project.archived

organisation.created
organisation.member_added
organisation.member_removed

objective.created
objective.updated
objective.completed
```

Events can later support:

- integrations
- webhooks
- audit history
- metrics processing

---

# 64. Metric Computation Model

Metrics can initially be computed directly from transactional data.

As usage grows:

1. write product events
2. persist event stream
3. asynchronously aggregate metric snapshots
4. cache common metric windows

Users should always be able to trace a metric back to raw events.

---

# 65. Sorting and Ordering Rules

Board order should be explicitly stored.

Recommended:

- fractional ordering keys
- lexicographic position IDs
- sparse integer positions

Avoid reindexing every card during each movement.

---

# 66. Deletion Behaviour

## Task deletion

Recommended:

- soft delete first
- allow undo
- permanent cleanup after retention window

## Commit deletion

Require explicit confirmation.

## Project deletion

Prefer archive over delete.

## Organisation deletion

Require owner confirmation and strong warning.

---

# 67. Archive Behaviour

Archived content:

- disappears from normal boards
- remains searchable if filter enabled
- remains represented in historical metrics
- preserves commits

Historical data should not be rewritten merely because a project was archived.

---

# 68. Time Zones

All server timestamps should be stored in UTC.

Display timestamps in the user's configured timezone.

Organisation metrics should permit:

- viewer timezone
- organisation timezone

Date-based graph cells should be calculated consistently.

---

# 69. Accessibility

State should support:

- keyboard navigation
- clear focus indicators
- screen-reader labels
- sufficient contrast
- reduced motion
- semantic HTML
- non-colour-only status indicators

---

# 70. Internationalisation

Launch language:

- English

Architecture should not make future internationalisation difficult.

Store user-facing dynamic text separately from system identifiers where appropriate.

---

# 71. Launch Scope

A strong first launch should include:

- paid subscription
- authentication
- personal workspace
- personal board
- organisations
- organisation board
- projects
- tasks
- manual commits
- automatic commits
- commit history
- horizontal execution graph
- Today
- basic metrics
- keyboard shortcuts
- command palette
- search
- recurring tasks
- responsive web UI
- billing
- export

Features that can wait:

- native mobile apps
- public API
- CLI
- GitHub integration
- advanced dependencies
- complex objective forecasting
- enterprise SSO
- SCIM
- advanced audit suite
- offline-first architecture

---

# 72. Non-Goals at Launch

Do not build:

- AI assistant
- docs/wiki
- whiteboards
- chat
- video meetings
- CRM
- calendar replacement
- timesheets
- payroll
- employee surveillance
- code hosting
- document editor
- no-code automation builder
- dozens of integrations
- social feed

These features dilute State's purpose.

---

# 73. Success Criteria

State should succeed if users increasingly rely on it as the canonical record of what they intended to do and what they actually executed.

Potential product metrics:

- trial-to-paid conversion
- paid retention
- daily active paid users
- weekly active paid users
- tasks created/user/week
- commits/user/week
- percentage of users viewing history
- percentage of users viewing metrics
- project creation rate
- organisation creation rate
- paid organisation retention
- average command-palette usage
- median task completion rate

These metrics are for internal product management, not necessarily shown to end users.

---

# 74. Product Moat

State's differentiation should come from product coherence rather than feature count.

Core differentiators:

1. execution as a first-class concept
2. commit-based work history
3. quantitative operational metrics
4. horizontal execution graph
5. personal and organisational execution under one model
6. deterministic, transparent measurements
7. keyboard-first interaction
8. deliberately minimal product scope
9. no advertising
10. no AI-first positioning
11. Ksan Relay's quantitative brand identity

The strongest differentiator is the combination of:

```text
Task planning + execution ledger + measurable output history
```

---

# 75. Product Narrative

Traditional task managers answer:

> What do I need to do?

Project management tools answer:

> What is the team working on?

State should answer:

> What was supposed to happen, what actually happened, and how consistently is execution occurring?

That is the conceptual centre of the product.

---

# 76. Final Product Definition

> State by Ksan Relay is a paid quantitative execution system for individuals and organisations. It combines tasks, kanban boards, projects, commit-style completion history, a horizontal execution graph, and transparent operational metrics such as execution, velocity, throughput, completion ratio, cycle time, and consistency. It is designed to be fast, minimal, keyboard-first, ad-free, and intentionally free of generative-AI clutter.

The product should feel more like technical infrastructure for human execution than a conventional productivity application.

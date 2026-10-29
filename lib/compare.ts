/**
 * Comparison pages (/compare/[slug]). Each entry says what the other tool is for in
 * stable, broadly known terms and where State differs. No competitor prices or feature
 * counts: they change too often to keep accurate. Review every entry when a tool changes.
 */
export interface Comparison {
  slug: string;
  name: string;
  // Search phrasing used in the page title and description
  query: string;
  // What the other tool is, in one sentence
  is: string;
  // When someone should pick it instead
  pickThem: string;
  // When State is the better fit
  pickState: string;
  // Side-by-side rows: [topic, them, State]
  rows: [string, string, string][];
}

const STATE_ROWS = {
  model: "Tasks are the plan, commits are finished work",
  metrics: "Execution, velocity, throughput, cycle time, consistency, each with its formula",
  ai: "None, by design",
  gamification: "None: no points, badges or streak pressure",
  scope: "Personal and organisation workspaces, same math",
} as const;

export const COMPARISONS: Comparison[] = [
  {
    slug: "notion",
    name: "Notion",
    query: "Notion alternative",
    is: "Notion is a connected workspace for docs, wikis and databases, with task lists and boards built from database views.",
    pickThem: "You want one place for notes, docs and a team wiki, and tasks are a small part of it.",
    pickState: "You want a fast task board that records every finished task and shows how much you actually got done.",
    rows: [
      ["Built for", "Docs, wikis and flexible databases", "Planning and measuring executed work"],
      ["Task model", "Database pages with a status property", STATE_ROWS.model],
      ["Work metrics", "Build your own with formulas and charts", STATE_ROWS.metrics],
      ["AI", "Notion AI built in", STATE_ROWS.ai],
      ["Setup", "Design your own system from templates", "Opinionated: one board, one ledger, one graph"],
    ],
  },
  {
    slug: "trello",
    name: "Trello",
    query: "Trello alternative",
    is: "Trello is Atlassian’s kanban board app: lists of cards, extended with Power-Ups and automation.",
    pickThem: "You want a simple shared board and rely on Power-Ups to connect other tools.",
    pickState: "You like kanban but want each finished card weighted, logged and counted toward real metrics.",
    rows: [
      ["Built for", "Visual kanban boards", "Kanban plus a record of finished work"],
      ["Done cards", "Archived or left in a list", "Become immutable commits on your history"],
      ["Task weight", "Labels or custom fields", "Small 1 · Normal 2 · Major 4 · Milestone 8"],
      ["Work metrics", "Via Power-Ups or reports", STATE_ROWS.metrics],
      ["Scope", "Boards in workspaces", STATE_ROWS.scope],
    ],
  },
  {
    slug: "todoist",
    name: "Todoist",
    query: "Todoist alternative",
    is: "Todoist is a to-do list app with natural-language capture, projects, labels and filters.",
    pickThem: "You mainly want a quick personal to-do list with reminders across every device.",
    pickState: "You want your to-do list to add up: weighted tasks, a commit ledger and metrics instead of points.",
    rows: [
      ["Built for", "Personal to-do lists", "Tasks, finished work and the numbers behind it"],
      ["Progress", "Karma points and goals", "Execution and velocity from task weights"],
      ["Boards", "List or board view per project", "Kanban board with Σ weight per column"],
      ["Gamification", "Karma levels and streaks", STATE_ROWS.gamification],
      ["History", "Completed tasks log", "Execution graph and immutable commit ledger"],
    ],
  },
  {
    slug: "asana",
    name: "Asana",
    query: "Asana alternative",
    is: "Asana is a work management platform for teams: projects, timelines, portfolios and workflows.",
    pickThem: "You run cross-team programs and need portfolios, approvals and workload planning.",
    pickState: "You want a lighter board where finished work is measured with formulas anyone can check.",
    rows: [
      ["Built for", "Team and portfolio management", "Individuals and organisations measuring execution"],
      ["Task model", "Tasks, subtasks and milestones", STATE_ROWS.model],
      ["Work metrics", "Dashboards and reporting", STATE_ROWS.metrics],
      ["AI", "Asana AI features", STATE_ROWS.ai],
      ["Weight", "Custom fields", "Small 1 · Normal 2 · Major 4 · Milestone 8"],
    ],
  },
  {
    slug: "clickup",
    name: "ClickUp",
    query: "ClickUp alternative",
    is: "ClickUp is an all-in-one work platform: tasks, docs, chat, goals and dashboards in one app.",
    pickThem: "You want one tool to replace several and are happy to configure it.",
    pickState: "You want fewer features, a faster board and metrics that need no setup.",
    rows: [
      ["Built for", "Everything in one place", "Plan, execute, measure"],
      ["Setup", "Highly configurable spaces and views", "Opinionated: one board, one ledger, one graph"],
      ["Work metrics", "Configurable dashboards", STATE_ROWS.metrics],
      ["AI", "ClickUp Brain", STATE_ROWS.ai],
      ["Structure", "Spaces, folders, lists and tasks", STATE_ROWS.scope],
    ],
  },
  {
    slug: "jira",
    name: "Jira",
    query: "Jira alternative",
    is: "Jira is Atlassian’s issue and project tracker for software teams: sprints, story points and workflows.",
    pickThem: "You run Scrum for an engineering team and need issue workflows, sprints and dev integrations.",
    pickState: "You want sprint-style velocity and cycle time for any kind of work, without configuring workflows.",
    rows: [
      ["Built for", "Software issue tracking", "Any discipline: study, build, write, train, design"],
      ["Estimation", "Story points per team", "Fixed weights: Small 1 · Normal 2 · Major 4 · Milestone 8"],
      ["Velocity", "Per sprint, from story points", "Execution ÷ days, any period"],
      ["Cycle time", "Control chart reports", "Median of completed_at − started_at"],
      ["Setup", "Workflows, schemes and permissions", "Ready on sign-up"],
    ],
  },
  {
    slug: "linear",
    name: "Linear",
    query: "Linear alternative",
    is: "Linear is an issue tracker for software teams with cycles, projects and a keyboard-first interface.",
    pickThem: "You build software and want issues tied to your code, cycles and roadmaps.",
    pickState: "You want Linear-style speed for work that is not software, with commits and metrics built in.",
    rows: [
      ["Built for", "Software product teams", "Any discipline, solo or team"],
      ["Unit of work", "Issues", STATE_ROWS.model],
      ["Estimation", "Team-defined point scales", "Small 1 · Normal 2 · Major 4 · Milestone 8"],
      ["Work metrics", "Cycle and project insights", STATE_ROWS.metrics],
      ["Keyboard", "Keyboard-first", "Keyboard-first"],
    ],
  },
  {
    slug: "salesforce",
    name: "Salesforce",
    query: "Salesforce task management alternative",
    is: "Salesforce is a CRM: accounts, contacts, leads and opportunities, with tasks attached to those records.",
    pickThem: "You manage customers and a sales pipeline. State is not a CRM and does not replace one.",
    pickState: "You want to track your own work, not deals: a task board, a record of what got done, and the numbers.",
    rows: [
      ["Built for", "Customer relationships and sales pipeline", "Planning and measuring executed work"],
      ["Tasks", "Activities logged against CRM records", "Weighted tasks on a kanban board"],
      ["Reporting", "Pipeline and activity reports", STATE_ROWS.metrics],
      ["AI", "Einstein and Agentforce", STATE_ROWS.ai],
      ["Setup", "Admin configuration", "Ready on sign-up"],
    ],
  },
];

export function getComparison(slug: string) {
  return COMPARISONS.find((c) => c.slug === slug);
}

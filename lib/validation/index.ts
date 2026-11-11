import { z } from "zod";

/**
 * Task creation & update schemas
 */
export const PRIORITIES = ["none", "low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const RECURRENCE_RULES = /^(daily|weekdays|weekly|monthly|interval:[1-9]\d{0,2})$/;

// Only title is required; omitting boardId/columnId places the task in the Inbox
export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  description: z.string().trim().max(10_000).optional(),
  projectId: z.string().optional().nullable(),
  boardId: z.string().min(1).optional().nullable(),
  columnId: z.string().min(1).optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  priority: z.enum(PRIORITIES).default("none"),
  weight: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]).default(2),
  dueAt: z.coerce.date().optional().nullable(),
  recurrenceRule: z.string().regex(RECURRENCE_RULES, "Invalid recurrence").optional().nullable(),
});

export type TaskInput = z.infer<typeof taskSchema>;

/**
 * Commit creation schema (manual or terminal completion)
 */
export const commitSchema = z.object({
  message: z.string().trim().min(1, "Commit message is required").max(500),
  workspaceId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
  executionValue: z.number().int().min(1).max(32).default(2),
  source: z.enum(["task_completion", "manual", "imported", "integration"]).default("manual"),
});

export type CommitInput = z.infer<typeof commitSchema>;

/**
 * Commit edits are limited: message clarification, project reassignment, tags.
 * Timestamp, execution value, and source are immutable.
 */
export const commitUpdateSchema = z.strictObject({
  message: z.string().trim().min(1, "Commit message is required").max(500).optional(),
  projectId: z.string().optional().nullable(),
  tagIds: z.array(z.string().min(1)).max(50).optional(),
});

export type CommitUpdateInput = z.infer<typeof commitUpdateSchema>;

/**
 * Product mutations (Server Actions). Only ids and user-editable fields are accepted;
 * workspace, author, timestamps and execution value are always derived on the server.
 * strictObject rejects unknown keys, so extra fields like userId or workspaceId fail.
 */
export const objectId = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "Invalid id");

export const moveTaskSchema = z.strictObject({
  taskId: objectId,
  columnId: objectId,
  /** Card directly above the drop position in the target column; null = top. */
  afterTaskId: objectId.nullable(),
});

/** Inbox triage: puts an untriaged task into a column of a board in its own workspace. */
export const placeTaskSchema = z.strictObject({
  taskId: objectId,
  columnId: objectId,
});

/** Title edit from the task panel. Same length limit as a capture. */
export const renameTaskSchema = z.strictObject({
  taskId: objectId,
  title: z.string().trim().min(1, "Give the task a title.").max(500, "Keep the title under 500 characters."),
});

export const setTaskPrioritySchema = z.strictObject({
  taskId: objectId,
  priority: z.enum(PRIORITIES),
});

/** Weight of an open task; a completed task's weight is fixed by its commit. */
export const setTaskWeightSchema = z.strictObject({
  taskId: objectId,
  weight: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]),
});

/**
 * Due date as a calendar day (YYYY-MM-DD) in the actor's timezone, or null to clear.
 * The server stores the end of that day as UTC.
 */
export const setTaskDueSchema = z.strictObject({
  taskId: objectId,
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.")
    .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), "Pick a real date.")
    .refine((d) => d >= "2000-01-01" && d <= "2100-12-31", "Pick a date between 2000 and 2100.")
    .nullable(),
});

/** Repeat rule of an open task, or null to stop repeating. */
export const setTaskRecurrenceSchema = z.strictObject({
  taskId: objectId,
  rule: z.string().regex(RECURRENCE_RULES, "Pick how often it repeats.").nullable(),
});

/** A task straight onto the personal board's Queued column (first-run setup). */
export const addBoardTaskSchema = z.strictObject({
  title: z.string().trim().min(1, "Give the task a title.").max(500, "Keep the title under 500 characters."),
  weight: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]),
});

/** First-run setup done or skipped; takes nothing. */
export const finishOnboardingSchema = z.strictObject({});

/** Delete and undo-delete take only the task id. */
export const taskRefSchema = z.strictObject({
  taskId: objectId,
});

export const captureTaskSchema = z.strictObject({
  text: z.string().trim().min(1, "Type a task first.").max(500),
});

export const manualCommitSchema = z.strictObject({
  message: z.string().trim().min(1, "Describe what you did.").max(500),
  projectId: objectId.nullable(),
  weight: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]),
});

/**
 * Commit correction: message, project and tags only. Time, execution value, author,
 * source and the linked task never change, so they are not accepted here.
 */
export const COMMIT_TAGS_MAX = 10;

export const editCommitSchema = z.strictObject({
  commitId: objectId,
  message: z.string().trim().min(1, "Describe what you did.").max(500, "Keep the message under 500 characters."),
  projectId: objectId.nullable(),
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(50, "Keep tags under 50 characters.").regex(/^[^,#\s][^,]*$/, "Separate tags with commas."))
    .max(COMMIT_TAGS_MAX, `Up to ${COMMIT_TAGS_MAX} tags.`)
    .transform((list) => [...new Set(list)]),
});

/**
 * Objectives (docs/state_desc.md §24): a measurable position with a target. "manual"
 * counts any unit by hand; "execution" sums commit execution since the objective started.
 */
export const OBJECTIVE_MEASURES = ["manual", "execution"] as const;

const calendarDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.")
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), "Pick a real date.")
  .refine((d) => d >= "2000-01-01" && d <= "2100-12-31", "Pick a date between 2000 and 2100.");

const objectiveAmount = z.number({ error: "Enter a whole number." }).int("Enter a whole number.").min(0).max(1_000_000, "Keep it under 1,000,000.");

export const createObjectiveSchema = z
  .strictObject({
    name: z.string().trim().min(1, "Name the objective.").max(100, "Keep the name under 100 characters."),
    measure: z.enum(OBJECTIVE_MEASURES),
    unit: z.string().trim().max(24, "Keep the unit under 24 characters."),
    targetValue: objectiveAmount.min(1, "Set a target above 0."),
    deadline: calendarDay.nullable(),
    projectId: objectId.nullable(),
  })
  .refine((o) => o.measure === "execution" || o.unit.length > 0, { path: ["unit"], message: "Name what you count, like modules." });

export const setObjectiveProgressSchema = z.strictObject({
  objectiveId: objectId,
  currentValue: objectiveAmount,
});

export const setObjectiveArchivedSchema = z.strictObject({
  objectiveId: objectId,
  archived: z.boolean(),
});

/**
 * Project creation, always in the actor's personal workspace. The slug is what `#slug` matches in quick capture.
 */
export const PROJECT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A one-line summary shown under the project's name. */
export const PROJECT_DESCRIPTION_MAX = 128;

const projectFields = {
  name: z.string().trim().min(1, "Give the project a name.").max(100, "Keep the name under 100 characters."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Add a slug for #capture.")
    .max(100, "Keep the slug under 100 characters.")
    .regex(PROJECT_SLUG, "Use lowercase letters, numbers and single hyphens, like relay-db."),
  description: z.string().trim().max(PROJECT_DESCRIPTION_MAX, `Keep the description to ${PROJECT_DESCRIPTION_MAX} characters.`).nullable(),
};

export const createProjectSchema = z.strictObject(projectFields);

/** Statuses set by hand. Archiving is separate (archivedAt) and has its own action. */
export const PROJECT_STATUSES = ["planned", "active", "paused", "completed"] as const;

export const updateProjectSchema = z.strictObject({
  projectId: objectId,
  ...projectFields,
  status: z.enum(PROJECT_STATUSES),
});

export const setProjectArchivedSchema = z.strictObject({
  projectId: objectId,
  archived: z.boolean(),
});

/** Slug suggested from a project name: "Relay DB v2" becomes "relay-db-v2". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/, "");
}

/** Weekday words the capture parser reads, by day number (0 = Sunday). */
const WEEKDAY_WORDS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const DUE_TOKEN = new RegExp(`(?:^|\\s)(today|tomorrow|${Object.keys(WEEKDAY_WORDS).join("|")}|\\d{4}-\\d{2}-\\d{2})(?=\\s|$)`, "i");

const shiftDay = (day: string, days: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const isRealDay = (day: string) =>
  !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().startsWith(day) && day >= "2000-01-01" && day <= "2100-12-31";

/**
 * Quick Inbox capture parser (deterministic syntax, no language model), e.g.
 * "implement caching tomorrow #relaydb !high @ana".
 *
 *   #project      project by slug
 *   !priority     critical, high, medium or low
 *   @me           assign to yourself (the only person in a workspace)
 *   due day       today, tomorrow, a weekday (the next one after today) or YYYY-MM-DD
 *
 * Each token is read once (the first match) and removed from the title. Dates resolve
 * against `today` (YYYY-MM-DD in the person's timezone); an impossible date stays in the
 * title as typed.
 */
export function parseQuickCapture(input: string, today: string = new Date().toISOString().slice(0, 10)): {
  title: string;
  projectSlug?: string;
  priority?: Exclude<Priority, "none">;
  dueDate?: string;
  assignee?: string;
} {
  let text = input.trim();
  let projectSlug: string | undefined;
  let priority: Exclude<Priority, "none"> | undefined;
  let dueDate: string | undefined;
  let assignee: string | undefined;
  const take = (match: RegExpMatchArray) => {
    text = (text.slice(0, match.index) + " " + text.slice(match.index! + match[0].length)).replace(/\s+/g, " ").trim();
  };

  // Extract #project
  const projectMatch = text.match(/#([\w-]+)/);
  if (projectMatch) {
    projectSlug = projectMatch[1];
    take(projectMatch);
  }

  // Extract !priority
  const priorityMatch = text.match(/!(critical|high|medium|low)\b/i);
  if (priorityMatch) {
    priority = priorityMatch[1].toLowerCase() as Exclude<Priority, "none">;
    take(priorityMatch);
  }

  // Extract @person (not the @ inside an email address)
  const personMatch = text.match(/(?:^|\s)@([a-z0-9][a-z0-9._-]{0,63})(?=\s|$)/i);
  if (personMatch) {
    assignee = personMatch[1].toLowerCase();
    take(personMatch);
  }

  // Extract a due day
  const dueMatch = text.match(DUE_TOKEN);
  if (dueMatch) {
    const word = dueMatch[1].toLowerCase();
    const weekday = WEEKDAY_WORDS[word];
    const day =
      word === "today"
        ? today
        : word === "tomorrow"
          ? shiftDay(today, 1)
          : weekday !== undefined
            ? shiftDay(today, ((weekday - new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7) + 1)
            : word;
    if (isRealDay(day)) {
      dueDate = day;
      take(dueMatch);
    }
  }

  return {
    title: text,
    projectSlug,
    priority,
    dueDate,
    assignee,
  };
}

/**
 * Data import (State JSON export, or a tasks / commits / projects CSV). Rows go into the
 * importer's personal workspace; workspace, author and ids are always assigned on the
 * server, so unknown keys in a row (ids, userId, workspaceId, source) are dropped.
 * Original timestamps are kept: they are when the work happened.
 */
export const IMPORT_LIMITS = { bytes: 4 * 1024 * 1024, projects: 1_000, tags: 1_000, tasks: 10_000, commits: 20_000 } as const;

export const TASK_IMPORT_STATUSES = ["inbox", "queued", "active", "review", "done"] as const;

const weightValue = z.coerce
  .number()
  .pipe(z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)], { error: "Weight must be 1, 2, 4 or 8." }));

const validDate = (max: () => number, message: string) =>
  z.coerce
    .date({ error: "Use an ISO date, like 2026-10-29T09:30:00Z." })
    .refine((d) => d.getTime() >= Date.UTC(2000, 0, 1) && d.getTime() <= max(), message);
// Past events may carry a clock a little ahead; due dates may be far ahead
const pastDate = validDate(() => Date.now() + 86_400_000, "Dates must fall between 2000 and today.");
const dueDate = validDate(() => Date.UTC(2101, 0, 1), "Due dates must fall between 2000 and 2100.");

/** Project references are matched by slug; "Relay DB" is read as relay-db. */
const projectRef = z
  .string()
  .transform((value) => slugify(value) || null)
  .nullish();

const importTags = z.array(z.string().trim().min(1).max(50, "Keep tag names under 50 characters.")).max(20, "Up to 20 tags per row.").default([]);

/** Ids from the source file, used only to link commits to tasks within one import. */
const sourceRef = z.coerce.string().trim().min(1).max(64).nullish();

export const importProjectSchema = z.object({
  name: projectFields.name,
  slug: projectFields.slug,
  description: projectFields.description.optional(),
  status: z.enum([...PROJECT_STATUSES, "archived"]).default("active"),
  createdAt: pastDate.nullish(),
  archivedAt: pastDate.nullish(),
});

export const importTaskSchema = z.object({
  id: sourceRef,
  title: z.string().trim().min(1, "Give the task a title.").max(500, "Keep the title under 500 characters."),
  description: z.string().trim().max(10_000).nullish(),
  project: projectRef,
  status: z.enum(TASK_IMPORT_STATUSES, { error: "Status must be inbox, queued, active, review or done." }).default("queued"),
  priority: z.enum(PRIORITIES, { error: "Priority must be none, low, medium, high or critical." }).default("none"),
  weight: weightValue.default(2),
  recurrenceRule: z.string().regex(RECURRENCE_RULES, "Invalid recurrence").nullish(),
  dueAt: dueDate.nullish(),
  startedAt: pastDate.nullish(),
  completedAt: pastDate.nullish(),
  createdAt: pastDate.nullish(),
  archivedAt: pastDate.nullish(),
  tags: importTags,
});

export const importCommitSchema = z.object({
  message: z.string().trim().min(1, "Describe what was done.").max(500, "Keep the message under 500 characters."),
  project: projectRef,
  taskId: sourceRef,
  executionValue: weightValue,
  createdAt: pastDate,
  tags: importTags,
});

export const importSchema = z.object({
  projects: z.array(importProjectSchema).max(IMPORT_LIMITS.projects, `Up to ${IMPORT_LIMITS.projects} projects per import.`).default([]),
  tasks: z.array(importTaskSchema).max(IMPORT_LIMITS.tasks, `Up to ${IMPORT_LIMITS.tasks} tasks per import.`).default([]),
  commits: z.array(importCommitSchema).max(IMPORT_LIMITS.commits, `Up to ${IMPORT_LIMITS.commits} commits per import.`).default([]),
});

export type ImportData = z.infer<typeof importSchema>;

/**
 * Permanent account deletion. `confirm` must be the account's email; `password` is
 * required when the account has one (checked on the server).
 */
export const deleteAccountSchema = z.strictObject({
  confirm: z.string().trim().max(320),
  password: z.string().max(128).optional(),
});

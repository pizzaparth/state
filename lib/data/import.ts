import { z } from "zod";
import { importSchema, parseQuickCapture, type ImportData } from "@/lib/validation";
import { zoneOffsetMs } from "@/lib/tz";
import { parseCsv } from "./csv";

/**
 * Reads an uploaded file into validated import rows. Accepts the State JSON export, or a
 * CSV of tasks (has a `title` column), commits (`message`) or projects (`slug` + `name`)
 * with the same columns the CSV export writes. Validation stops at the first problem and
 * names its row, so a file is imported whole or not at all.
 */
export type ParsedImport = { ok: true; data: ImportData; kind: string } | { ok: false; error: string; errors: string[] };

const PREVIEW_ERRORS = 10;

const CSV_LIST = /\s*;\s*/;

const CAMEL: Record<string, string> = {
  taskid: "taskId",
  executionvalue: "executionValue",
  recurrencerule: "recurrenceRule",
  dueat: "dueAt",
  startedat: "startedAt",
  completedat: "completedAt",
  createdat: "createdAt",
  archivedat: "archivedAt",
};

function fromCsv(text: string): { rows: Partial<Record<keyof ImportData, unknown[]>>; kind: string } | string {
  const records = parseCsv(text);
  if (!records) return "The CSV has an unclosed quote.";
  if (records.length === 0) return "The file has no rows.";
  const columns = new Set(Object.keys(records[0]));
  // Empty cells mean "not set" (the schema fills defaults). Export headers are
  // camelCase and parseCsv lower-cases them, so map them back.
  const clean = records.map((r) =>
    Object.fromEntries(
      Object.entries(r)
        .filter(([, v]) => v.trim() !== "")
        .map(([k, v]) => [CAMEL[k] ?? k, k === "tags" ? v.split(CSV_LIST).filter(Boolean) : v])
    )
  );
  if (columns.has("message")) {
    // Hand-made commit sheets often call execution "weight"
    const commits = clean.map(({ weight, ...row }) => ({ executionValue: weight, ...row }));
    return { rows: { commits }, kind: "commits" };
  }
  if (columns.has("title")) return { rows: { tasks: clean }, kind: "tasks" };
  if (columns.has("slug") && columns.has("name")) return { rows: { projects: clean }, kind: "projects" };
  return "Add a header row with title (tasks), message (commits) or slug and name (projects).";
}

function describe(error: z.ZodError): string {
  return describeIssue(error.issues[0]);
}

function describeIssue(issue: z.core.$ZodIssue | undefined): string {
  if (!issue) return "Check the file and try again.";
  const [section, index, field] = issue.path;
  if (typeof section === "string" && typeof index === "number") {
    const where = `${section.replace(/s$/, "")} ${index + 1}`;
    return `${where}${typeof field === "string" ? `, ${field}` : ""}: ${issue.message}`;
  }
  return issue.message;
}

/**
 * A plain list: one task per line, read with the capture rules (#project, !priority, +4,
 * due words, ~repeat). Blank lines and list markers are skipped. Due days end at 23:59 in
 * the importer's zone.
 */
function fromText(text: string, tz: string): Partial<Record<keyof ImportData, unknown[]>> | string {
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]\])\s+/, "").trim())
    .filter(Boolean);
  if (lines.length === 0) return "The file has no lines.";
  const endOfDay = (day: string) => {
    const local = Date.parse(`${day}T23:59:00Z`);
    return new Date(local - zoneOffsetMs(tz, new Date(local))).toISOString();
  };
  const tasks = lines.map((line) => {
    const p = parseQuickCapture(line, today);
    return {
      title: p.title || line,
      project: p.projectSlug ?? null,
      priority: p.priority ?? "none",
      weight: p.weight ?? 2,
      recurrenceRule: p.repeat ?? null,
      dueAt: p.dueDate ? endOfDay(p.dueDate) : null,
      status: "inbox",
    };
  });
  return { tasks };
}

/** `format` "txt" reads a plain task list; otherwise JSON or CSV is detected from the content. */
export function parseImport(text: string, opts: { format?: "txt"; tz?: string } = {}): ParsedImport {
  const body = text.replace(/^﻿/, "").trimStart();
  if (!body) return { ok: false, error: "The file is empty.", errors: ["The file is empty."] };
  const fail = (error: string): ParsedImport => ({ ok: false, error, errors: [error] });

  let rows: unknown;
  let kind = "JSON";
  if (opts.format === "txt") {
    const list = fromText(body, opts.tz ?? "UTC");
    if (typeof list === "string") return fail(list);
    rows = list;
    kind = "task list";
  } else if (body.startsWith("{") || body.startsWith("[")) {
    try {
      rows = JSON.parse(body);
    } catch {
      return fail("The JSON could not be read. Upload a State export, a CSV or a .txt list.");
    }
    if (Array.isArray(rows)) return fail("Upload a State JSON export (an object with tasks, commits and projects).");
  } else {
    const csv = fromCsv(body);
    if (typeof csv === "string") return fail(csv);
    rows = csv.rows;
    kind = csv.kind;
  }

  const parsed = importSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: describe(parsed.error), errors: parsed.error.issues.slice(0, PREVIEW_ERRORS).map(describeIssue) };
  const { projects, tasks, commits } = parsed.data;
  if (projects.length + tasks.length + commits.length === 0) return fail("Nothing to import: no projects, tasks or commits found.");
  return { ok: true, data: parsed.data, kind };
}

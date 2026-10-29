import { z } from "zod";
import { importSchema, type ImportData } from "@/lib/validation";
import { parseCsv } from "./csv";

/**
 * Reads an uploaded file into validated import rows. Accepts the State JSON export, or a
 * CSV of tasks (has a `title` column), commits (`message`) or projects (`slug` + `name`)
 * with the same columns the CSV export writes. Validation stops at the first problem and
 * names its row, so a file is imported whole or not at all.
 */
export type ParsedImport = { ok: true; data: ImportData; kind: string } | { ok: false; error: string };

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
  const issue = error.issues[0];
  if (!issue) return "Check the file and try again.";
  const [section, index, field] = issue.path;
  if (typeof section === "string" && typeof index === "number") {
    const where = `${section.replace(/s$/, "")} ${index + 1}`;
    return `${where}${typeof field === "string" ? `, ${field}` : ""}: ${issue.message}`;
  }
  return issue.message;
}

export function parseImport(text: string): ParsedImport {
  const body = text.replace(/^﻿/, "").trimStart();
  if (!body) return { ok: false, error: "The file is empty." };

  let rows: unknown;
  let kind = "JSON";
  if (body.startsWith("{") || body.startsWith("[")) {
    try {
      rows = JSON.parse(body);
    } catch {
      return { ok: false, error: "The JSON could not be read. Upload a State export or a CSV." };
    }
    if (Array.isArray(rows)) return { ok: false, error: "Upload a State JSON export (an object with tasks, commits and projects)." };
  } else {
    const csv = fromCsv(body);
    if (typeof csv === "string") return { ok: false, error: csv };
    rows = csv.rows;
    kind = csv.kind;
  }

  const parsed = importSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  const { projects, tasks, commits } = parsed.data;
  if (projects.length + tasks.length + commits.length === 0) return { ok: false, error: "Nothing to import: no projects, tasks or commits found." };
  return { ok: true, data: parsed.data, kind };
}

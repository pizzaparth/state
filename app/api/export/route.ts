import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { toCsv } from "@/lib/data/csv";
import { buildExport, exportCommits, exportProjects, exportTasks, personalWorkspaceId } from "@/lib/data/export";
import { consumeThrottle } from "@/lib/security/throttle";

/**
 * Downloads the signed-in person's data. Needs a session: data
 * stays exportable after a subscription ends (docs/state_desc.md §40).
 *
 *   ?format=json                          everything (lib/data/export.ts)
 *   ?format=csv&dataset=tasks|commits|projects
 */
const querySchema = z.discriminatedUnion("format", [
  z.strictObject({ format: z.literal("json") }),
  z.strictObject({ format: z.literal("csv"), dataset: z.enum(["tasks", "commits", "projects"]) }),
]);

const TASK_COLUMNS = ["id", "title", "description", "project", "status", "priority", "weight", "recurrenceRule", "dueAt", "startedAt", "completedAt", "createdAt", "archivedAt", "tags"] as const;
const COMMIT_COLUMNS = ["id", "message", "project", "taskId", "executionValue", "source", "createdAt", "tags"] as const;
const PROJECT_COLUMNS = ["name", "slug", "description", "status", "createdAt", "archivedAt"] as const;

const joinTags = <T extends { tags: string[] }>(rows: T[]) => rows.map((r) => ({ ...r, tags: r.tags.join("; ") }));

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to export your data." }, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Choose format=json, or format=csv with dataset=tasks, commits or projects." }, { status: 400 });

  // Each export reads the whole workspace; cap them per account
  if (!(await consumeThrottle(`export:${session.user.id}`, 30, 60 * 60))) {
    return NextResponse.json({ error: "Too many exports. Try again in an hour." }, { status: 429 });
  }

  const day = new Date().toISOString().slice(0, 10);
  const query = parsed.data;
  let body: string;
  let name: string;
  let type: string;
  if (query.format === "json") {
    body = JSON.stringify(await buildExport(session.user.id), null, 2);
    name = `state-export-${day}.json`;
    type = "application/json; charset=utf-8";
  } else {
    const workspaceId = await personalWorkspaceId(session.user.id);
    if (query.dataset === "tasks") body = toCsv(TASK_COLUMNS, joinTags(workspaceId ? await exportTasks(workspaceId) : []));
    else if (query.dataset === "commits") body = toCsv(COMMIT_COLUMNS, joinTags(workspaceId ? await exportCommits(workspaceId) : []));
    else body = toCsv(PROJECT_COLUMNS, workspaceId ? await exportProjects(workspaceId) : []);
    name = `state-${query.dataset}-${day}.csv`;
    type = "text/csv; charset=utf-8";
  }

  return new NextResponse(body, {
    headers: {
      "content-type": type,
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}

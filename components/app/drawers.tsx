import * as React from "react";
import { getBoardColumns, getBoardTargets, getCommitDetail, getProjectOptions, getTagNames, getTaskDetail, getTaskHistory } from "@/db/queries";
import { recurrenceLabel } from "@/lib/recurrence";
import type { Viewer } from "@/lib/viewer-data";
import { DetailDrawer, DrawerClose } from "./detail-drawer";
import { EmptyState } from "./primitives";
import { CommitDetail, TaskDetail } from "./details";
import { TaskActions } from "./task-actions";

export type PageSearchParams = Promise<Record<string, string | undefined>>;

// Mirrors loadActor: the server re-checks on every write, this only hides controls
const canWrite = (viewer: Viewer, workspaceId: string) => workspaceId === viewer.personalWorkspaceId;

// Mirrors editCommit: only the author
const canEditCommit = (viewer: Viewer, commit: { workspaceId: string; userId: string }) => canWrite(viewer, commit.workspaceId) && commit.userId === viewer.id;

// Repeated (?task=a&task=b) or malformed ids never reach a query
const objectIdParam = (value: unknown) => (typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null);

type TaskDetailData = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;
type CommitDetailData = NonNullable<Awaited<ReturnType<typeof getCommitDetail>>>;

/** What the URL's panel needs: loaded by the page (server, or the demo in the browser). */
export type DrawersData =
  | { kind: "none" }
  | { kind: "missing"; param: "task" | "commit" }
  | {
      kind: "task";
      task: TaskDetailData;
      writable: boolean;
      targets: Awaited<ReturnType<typeof getBoardTargets>>;
      projects: Awaited<ReturnType<typeof getProjectOptions>> | undefined;
      statusColumns: Awaited<ReturnType<typeof getBoardColumns>> | undefined;
      tagNames: string[];
      history: { at: Date; text: string }[];
      nav?: { prevId: string | null; nextId: string | null };
    }
  | { kind: "commit"; commit: CommitDetailData; projects: Awaited<ReturnType<typeof getProjectOptions>> | undefined };

/**
 * Loads the task or commit panel named in the URL, if the viewer may read it. `siblings`
 * (the page's list, for J/K) may still be loading, so pages load the panel alongside it.
 */
export async function loadDrawers(params: Record<string, string | undefined>, viewer: Viewer, siblings?: string[] | Promise<string[]>): Promise<DrawersData> {
  // Not always awaited below; the page's own await reports a failed list
  void Promise.resolve(siblings).catch(() => {});
  const taskId = objectIdParam(params.task);
  const commitId = objectIdParam(params.commit);
  if (taskId) {
    const task = await getTaskDetail(taskId, viewer.workspaceIds);
    if (task) {
      const writable = canWrite(viewer, task.workspaceId);
      const inInbox = task.boardId === null;
      const [targets, projects, statusColumns, tagNames, events, order] = await Promise.all([
        writable && inInbox && !task.completedAt ? getBoardTargets(task.workspaceId, viewer.workspaceIds) : [],
        writable ? getProjectOptions(task.workspaceId, viewer.workspaceIds) : undefined,
        task.boardId ? getBoardColumns(task.boardId, viewer.workspaceIds) : undefined,
        writable ? getTagNames(viewer.workspaceIds) : [],
        getTaskHistory(task.id, viewer.workspaceIds),
        siblings,
      ]);
      const columnName = (id: unknown) => statusColumns?.find((c) => c.id === id)?.name ?? "a column";
      const history = events.map((e) => ({ at: e.createdAt, text: describeEvent(e.action, (e.metadata ?? {}) as Record<string, unknown>, columnName) }));
      const nav = order && order.includes(task.id) ? { prevId: order[order.indexOf(task.id) - 1] ?? null, nextId: order[order.indexOf(task.id) + 1] ?? null } : undefined;
      return { kind: "task", task, writable, targets, projects, statusColumns, tagNames, history, nav };
    }
  }
  if (commitId) {
    const commit = await getCommitDetail(commitId, viewer.workspaceIds);
    if (commit) {
      const projects = canEditCommit(viewer, commit) ? await getProjectOptions(commit.workspaceId, viewer.workspaceIds) : undefined;
      return { kind: "commit", commit, projects };
    }
  }
  // An id in the URL that is gone (deleted, or never readable): say so instead of nothing
  if (taskId) return { kind: "missing", param: "task" };
  if (commitId) return { kind: "missing", param: "commit" };
  return { kind: "none" };
}

/** Renders the panel loaded by loadDrawers. */
export function Drawers({ data, tz }: { data: DrawersData; tz: string }) {
  if (data.kind === "task") {
    const { task, writable } = data;
    const inInbox = task.boardId === null;
    return (
      <DetailDrawer
        param="task"
        title="Task"
        recent={{ kind: "task", id: task.id, title: task.title }}
        nav={data.nav}
        crumbs={[task.projectName, task.boardName ?? "Inbox", task.completedAt ? "Done" : task.columnName].filter((c): c is string => Boolean(c))}
      >
        <TaskDetail
          task={task}
          tz={tz}
          now={new Date()}
          editable={writable}
          projects={data.projects}
          statusColumns={writable ? data.statusColumns : undefined}
          tagSuggestions={data.tagNames}
          history={data.history}
        />
        {writable && (
          <TaskActions
            task={{ id: task.id, title: task.title, completed: Boolean(task.completedAt), inInbox }}
            targets={data.targets}
          />
        )}
      </DetailDrawer>
    );
  }
  if (data.kind === "commit") {
    const { commit } = data;
    return (
      <DetailDrawer param="commit" title="Commit" crumbs={commit.projectName ? [commit.projectName] : []} recent={{ kind: "commit", id: commit.id, title: commit.message }}>
        <CommitDetail commit={commit} tz={tz} projects={data.projects} />
      </DetailDrawer>
    );
  }
  if (data.kind === "missing") return <MissingPanel param={data.param} title={data.param === "task" ? "Task" : "Commit"} />;
  return null;
}

function MissingPanel({ param, title }: { param: string; title: string }) {
  return (
    <DetailDrawer param={param} title={title}>
      <EmptyState title={`${title} not found`} action={<DrawerClose />} />
    </DetailDrawer>
  );
}

/** One audit event as a few words for the task's history. */
function describeEvent(action: string, meta: Record<string, unknown>, columnName: (id: unknown) => string): string {
  switch (action) {
    case "task.moved":
      return `moved to ${columnName(meta.columnId)}`;
    case "task.renamed":
      return `renamed “${String(meta.title ?? "")}”`;
    case "task.priority":
      return `priority ${String(meta.priority)}`;
    case "task.weight":
      return `weight +${String(meta.weight)}`;
    case "task.due":
      return meta.due ? `due ${String(meta.due)}` : "due date cleared";
    case "task.project":
      return meta.project ? `filed under ${String(meta.project)}` : "unfiled";
    case "task.repeat":
      return meta.rule ? `repeats ${recurrenceLabel(String(meta.rule)).toLowerCase()}` : "stopped repeating";
    case "task.described":
      return "notes edited";
    case "task.tagged":
      return Array.isArray(meta.tags) && meta.tags.length ? `tags ${meta.tags.join(", ")}` : "tags cleared";
    case "task.deferred":
      return meta.until ? `not before ${String(meta.until)}` : "no longer deferred";
    case "task.planned":
      return "planned for today";
    case "task.unplanned":
      return "unplanned";
    case "task.skipped":
      return `skipped to ${String(meta.due)}`;
    case "task.duplicated":
      return "created as a copy";
    case "task.deleted":
      return "deleted";
    case "task.restored":
      return "restored";
    case "task.reopened":
      return "reopened, commit withdrawn";
    default:
      return action.replace(/^task\./, "");
  }
}

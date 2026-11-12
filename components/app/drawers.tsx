import * as React from "react";
import { getBoardTargets, getCommitDetail, getProjectOptions, getTaskDetail } from "@/db/queries";
import { dayKey } from "@/lib/format";
import type { Viewer } from "@/lib/viewer";
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

/** Renders the task or commit panel named in the URL, if the viewer may read it. */
export async function Drawers({ params, viewer }: { params: Record<string, string | undefined>; viewer: Viewer }) {
  const taskId = objectIdParam(params.task);
  const commitId = objectIdParam(params.commit);
  if (taskId) {
    const task = await getTaskDetail(taskId, viewer.workspaceIds);
    if (task) {
      const writable = canWrite(viewer, task.workspaceId);
      const inInbox = task.boardId === null;
      const [targets, projects] = await Promise.all([
        writable && inInbox && !task.completedAt ? getBoardTargets(task.workspaceId, viewer.workspaceIds) : [],
        writable ? getProjectOptions(task.workspaceId, viewer.workspaceIds) : undefined,
      ]);
      return (
        <DetailDrawer
          param="task"
          title="Task"
          crumbs={[task.projectName, task.boardName ?? "Inbox", task.completedAt ? "Done" : task.columnName].filter((c): c is string => Boolean(c))}
        >
          <TaskDetail task={task} tz={viewer.tz} now={new Date()} editable={writable} projects={projects} />
          {writable && (
            <TaskActions
              task={{ id: task.id, title: task.title, completed: Boolean(task.completedAt), inInbox, due: task.dueAt ? dayKey(task.dueAt, viewer.tz) : null }}
              targets={targets}
            />
          )}
        </DetailDrawer>
      );
    }
  }
  if (commitId) {
    const commit = await getCommitDetail(commitId, viewer.workspaceIds);
    if (commit) {
      const projects = canEditCommit(viewer, commit) ? await getProjectOptions(commit.workspaceId, viewer.workspaceIds) : undefined;
      return (
        <DetailDrawer param="commit" title="Commit" crumbs={commit.projectName ? [commit.projectName] : []}>
          <CommitDetail commit={commit} tz={viewer.tz} projects={projects} />
        </DetailDrawer>
      );
    }
  }
  // An id in the URL that is gone (deleted, or never readable): say so instead of nothing
  if (taskId) return <MissingPanel param="task" title="Task" />;
  if (commitId) return <MissingPanel param="commit" title="Commit" />;
  return null;
}

function MissingPanel({ param, title }: { param: string; title: string }) {
  return (
    <DetailDrawer param={param} title={title}>
      <EmptyState title={`${title} not found`} action={<DrawerClose />} />
    </DetailDrawer>
  );
}

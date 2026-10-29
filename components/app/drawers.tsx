import * as React from "react";
import { getBoardTargets, getCommitDetail, getTaskDetail } from "@/db/queries";
import { WRITE_ROLES } from "@/lib/authz";
import { dayKey } from "@/lib/format";
import type { Viewer } from "@/lib/viewer";
import { DetailDrawer } from "./detail-drawer";
import { CommitDetail, TaskDetail } from "./details";
import { TaskActions } from "./task-actions";

export type PageSearchParams = Promise<Record<string, string | undefined>>;

// Mirrors loadActor: the server re-checks on every write, this only hides controls
const canWrite = (viewer: Viewer, workspaceId: string) =>
  workspaceId === viewer.personalWorkspaceId ||
  viewer.orgs.some((o) => o.workspaceId === workspaceId && (WRITE_ROLES as readonly string[]).includes(o.role));

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
      const targets = writable && inInbox && !task.completedAt ? await getBoardTargets(task.workspaceId, viewer.workspaceIds) : [];
      return (
        <DetailDrawer param="task" title="Task">
          <TaskDetail task={task} tz={viewer.tz} now={new Date()} editable={writable} />
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
      return (
        <DetailDrawer param="commit" title="Commit">
          <CommitDetail commit={commit} tz={viewer.tz} />
        </DetailDrawer>
      );
    }
  }
  return null;
}

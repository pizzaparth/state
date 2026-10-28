import * as React from "react";
import { getCommitDetail, getTaskDetail } from "@/db/queries";
import type { Viewer } from "@/lib/viewer";
import { DetailDrawer } from "./detail-drawer";
import { CommitDetail, TaskDetail } from "./details";

export type PageSearchParams = Promise<Record<string, string | undefined>>;

// Repeated (?task=a&task=b) or malformed ids never reach a query
const objectIdParam = (value: unknown) => (typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null);

/** Renders the task or commit panel named in the URL, if the viewer may read it. */
export async function Drawers({ params, viewer }: { params: Record<string, string | undefined>; viewer: Viewer }) {
  const taskId = objectIdParam(params.task);
  const commitId = objectIdParam(params.commit);
  if (taskId) {
    const task = await getTaskDetail(taskId, viewer.workspaceIds);
    if (task) {
      return (
        <DetailDrawer param="task" title="Task">
          <TaskDetail task={task} tz={viewer.tz} now={new Date()} />
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

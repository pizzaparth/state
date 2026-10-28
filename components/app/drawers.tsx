import * as React from "react";
import { getCommitDetail, getTaskDetail } from "@/db/queries";
import type { Viewer } from "@/lib/viewer";
import { DetailDrawer } from "./detail-drawer";
import { CommitDetail, TaskDetail } from "./details";

export type PageSearchParams = Promise<Record<string, string | undefined>>;

/** Renders the task or commit panel named in the URL, if the viewer may read it. */
export async function Drawers({ params, viewer }: { params: Record<string, string | undefined>; viewer: Viewer }) {
  if (params.task) {
    const task = await getTaskDetail(params.task, viewer.workspaceIds);
    if (task) {
      return (
        <DetailDrawer param="task" title="Task">
          <TaskDetail task={task} tz={viewer.tz} now={new Date()} />
        </DetailDrawer>
      );
    }
  }
  if (params.commit) {
    const commit = await getCommitDetail(params.commit, viewer.workspaceIds);
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

import * as React from "react";
import { getBoard } from "@/db/queries";
import { dueState, initials } from "@/lib/format";
import type { Viewer } from "@/lib/viewer";
import { EmptyState, Panel } from "./primitives";
import { Kanban } from "./kanban";
import { withParam } from "./task-row";

/** Loads a board on the server and hands plain, pre-formatted cards to the client board. */
export async function BoardView({
  boardId,
  viewer,
  params,
  basePath,
  showAssignee,
}: {
  boardId: string | null;
  viewer: Viewer;
  params: Record<string, string | undefined>;
  basePath: string;
  showAssignee: boolean;
}) {
  const board = boardId ? await getBoard(boardId, viewer.workspaceIds) : null;
  if (!board) {
    return (
      <Panel>
        <EmptyState title="No board yet" />
      </Panel>
    );
  }
  const now = new Date();
  const cards = board.tasks
    .filter((t) => t.columnId)
    .map((t) => ({
      id: t.id,
      title: t.title,
      columnId: t.columnId as string,
      projectName: t.projectName,
      priority: t.priority,
      weight: t.weight,
      due: t.dueAt ? dueState(t.dueAt, now, viewer.tz) : null,
      assigneeName: t.assigneeName,
      assigneeInitials: t.assigneeName ? initials(t.assigneeName) : null,
      tags: t.tags,
    }));
  const taskHref = Object.fromEntries(cards.map((c) => [c.id, withParam(basePath, params, "task", c.id)]));

  return (
    <Kanban
      columns={board.columns}
      cards={cards}
      taskHref={taskHref}
      showAssignee={showAssignee}
      doneWindowDays={board.doneWindowDays}
    />
  );
}

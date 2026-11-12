import * as React from "react";
import { getBoard, getProjectOptions, getTagNames } from "@/db/queries";
import { dayKey, dueState } from "@/lib/format";
import type { Viewer } from "@/lib/viewer";
import type { SortKey } from "@/lib/board-sort";
import type { BoardFilter } from "@/lib/board-filter";
import { checklistCount } from "@/lib/checklist";
import { EmptyState, Panel } from "./primitives";
import { Kanban, type BoardCard } from "./kanban";
import { withParam } from "./task-row";

const DAY = 86_400_000;

/** Loads a board on the server and hands plain, pre-formatted cards to the client board. */
export async function BoardView({
  boardId,
  viewer,
  params,
  basePath,
  sort,
  filter,
  doneWindowDays = 14,
}: {
  boardId: string | null;
  viewer: Viewer;
  params: Record<string, string | undefined>;
  basePath: string;
  /** Starting sort; passing it shows the sort and filter bars. */
  sort?: SortKey[];
  filter?: BoardFilter;
  doneWindowDays?: number;
}) {
  const board = boardId ? await getBoard(boardId, viewer.workspaceIds, doneWindowDays) : null;
  if (!board) {
    return (
      <Panel>
        <EmptyState title="No board yet" />
      </Panel>
    );
  }
  const [projects, tags] = await Promise.all([
    viewer.personalWorkspaceId ? getProjectOptions(viewer.personalWorkspaceId, viewer.workspaceIds) : [],
    getTagNames(viewer.workspaceIds),
  ]);
  const now = new Date();
  const today = dayKey(now, viewer.tz);
  const cards: BoardCard[] = board.tasks
    .filter((t) => t.columnId)
    .map((t) => ({
      id: t.id,
      title: t.title,
      columnId: t.columnId as string,
      projectName: t.projectName,
      projectSlug: t.projectSlug,
      priority: t.priority,
      weight: t.weight,
      due: t.dueAt ? dueState(t.dueAt, now, viewer.tz) : null,
      dueAt: t.dueAt?.getTime() ?? null,
      dueDay: t.dueAt ? dayKey(t.dueAt, viewer.tz) : null,
      createdAt: t.createdAt.getTime(),
      completedAt: t.completedAt?.getTime() ?? null,
      tags: t.tags,
      recurring: Boolean(t.recurrenceRule),
      hasNote: Boolean(t.description?.trim()),
      checklist: checklistCount(t.description),
      daysInColumn: Math.floor((now.getTime() - t.columnEnteredAt.getTime()) / DAY),
      deferred: t.deferUntil !== null && t.deferUntil.getTime() > now.getTime() && !t.completedAt,
      deferLabel: t.deferUntil && t.deferUntil.getTime() > now.getTime() ? dueState(t.deferUntil, now, viewer.tz).label : null,
    }));
  const taskHref = Object.fromEntries(cards.map((c) => [c.id, withParam(basePath, params, "task", c.id)]));

  return (
    <Kanban
      columns={board.columns}
      cards={cards}
      taskHref={taskHref}
      doneWindowDays={board.doneWindowDays}
      initialSort={sort}
      initialFilter={filter}
      projects={projects.map((p) => ({ id: p.id, name: p.name, slug: p.slug }))}
      tags={tags}
      today={today}
      historyHref="/platform/history?source=task"
    />
  );
}

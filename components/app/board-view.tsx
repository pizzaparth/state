import * as React from "react";
import { getBoard, getProjectOptions, getTagNames } from "@/db/queries";
import { dayKey, dueState } from "@/lib/format";
import type { Viewer } from "@/lib/viewer-data";
import type { SortKey } from "@/lib/board-sort";
import type { BoardFilter } from "@/lib/board-filter";
import { checklistCount } from "@/lib/checklist";
import { EmptyState, Panel } from "./primitives";
import { Kanban, type BoardCard } from "./kanban";
import { withParam } from "./task-row";

const DAY = 86_400_000;

export type BoardViewData = Awaited<ReturnType<typeof loadBoardView>>;

/** Loads a board and turns it into plain, pre-formatted cards for the client board. */
export async function loadBoardView({
  boardId,
  viewer,
  params,
  basePath,
  sort,
  filter,
}: {
  boardId: string | null;
  viewer: Viewer;
  params: Record<string, string | undefined>;
  basePath: string;
  /** Starting sort; passing it shows the sort and filter bars. */
  sort?: SortKey[];
  filter?: BoardFilter;
}) {
  const [board, projects, tags] = await Promise.all([
    boardId ? getBoard(boardId, viewer.workspaceIds, viewer.tz) : null,
    viewer.personalWorkspaceId ? getProjectOptions(viewer.personalWorkspaceId, viewer.workspaceIds) : [],
    getTagNames(viewer.workspaceIds),
  ]);
  if (!board) return null;
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
  return {
    columns: board.columns,
    cards,
    taskHref,
    sort,
    filter,
    projects: projects.map((p) => ({ id: p.id, name: p.name, slug: p.slug })),
    tags,
    today,
  };
}

/** The board loaded by loadBoardView, or an empty state when there is none. */
export function BoardView({ data }: { data: BoardViewData }) {
  if (!data) {
    return (
      <Panel>
        <EmptyState title="No board yet" />
      </Panel>
    );
  }
  return (
    <Kanban
      columns={data.columns}
      cards={data.cards}
      taskHref={data.taskHref}
      initialSort={data.sort}
      initialFilter={data.filter}
      projects={data.projects}
      tags={data.tags}
      today={data.today}
      historyHref="/platform/history?source=task"
    />
  );
}

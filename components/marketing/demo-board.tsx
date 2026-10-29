"use client";

import * as React from "react";
import { Kanban, type BoardCard, type BoardColumn, type MoveTask } from "@/components/app/kanban";
import { NoticeProvider } from "@/components/app/notice";

/**
 * The product's Kanban on the landing page. Moves behave as on a real board (reaching
 * Done records a commit for the card's weight, leaving Done withdraws it) but stay in
 * this browser: nothing is sent to the server.
 */
export function DemoBoard({ columns, cards, showAssignee, doneWindowDays }: { columns: BoardColumn[]; cards: BoardCard[]; showAssignee: boolean; doneWindowDays: number }) {
  const doneId = columns.find((c) => c.stateType === "done")?.id;
  const done = React.useRef(new Set(cards.filter((c) => c.columnId === doneId).map((c) => c.id)));

  const move = React.useCallback<MoveTask>(
    async ({ taskId, columnId }) => {
      const wasDone = done.current.has(taskId);
      const toDone = columnId === doneId;
      if (toDone) done.current.add(taskId);
      else done.current.delete(taskId);
      const weight = cards.find((c) => c.id === taskId)?.weight ?? 0;
      return { ok: true, data: { committed: toDone && !wasDone ? weight : 0, reopened: wasDone && !toDone } };
    },
    [cards, doneId]
  );

  return (
    <NoticeProvider>
      <Kanban columns={columns} cards={cards} showAssignee={showAssignee} doneWindowDays={doneWindowDays} move={move} />
    </NoticeProvider>
  );
}

"use client";

import * as React from "react";
import type { BoardCard, BoardColumn } from "@/components/app/kanban";
import { DemoBoard } from "./demo-board";
import { ProductFrame } from "./product-frame";

type Board = { columns: BoardColumn[]; cards: BoardCard[] };

const FACTS = [
  "A private board, ready on first sign-in",
  "Three steps: Queued, Active, Done",
  "Every finished task adds to your history and metrics",
  "Nothing to set up",
];

/**
 * The personal board, shown as the product's own component. Drag a card, or use its ⋯
 * menu, to move it; reaching Done records a commit.
 */
export function WorkspaceScope({ board, doneWindowDays }: { board: Board; doneWindowDays: number }) {
  // A new key remounts the board, restoring its starting cards
  const [round, setRound] = React.useState(0);

  return (
    <div className="space-y-14">
      <ul className="grid gap-x-10 gap-y-3 text-base text-[#A9A9A6] sm:grid-cols-2">
        {FACTS.map((fact) => (
          <li key={fact} className="flex gap-3">
            <svg viewBox="0 0 12 12" aria-hidden="true" className="mt-[0.4em] size-3 shrink-0 text-accent">
              <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            {fact}
          </li>
        ))}
      </ul>

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-base text-[#F4F4F2]">
            Try it: <span className="text-[#A9A9A6]">drag a card to Done, or use its ⋯ menu.</span>
          </p>
          <button type="button" onClick={() => setRound((r) => r + 1)} className="text-sm text-[#A9A9A6] underline underline-offset-4 hover:text-white">
            Reset board
          </button>
        </div>
        <ProductFrame path="/platform/personal" caption="Personal board in the State app, with demo tasks">
          <DemoBoard key={round} {...board} showAssignee={false} doneWindowDays={doneWindowDays} />
        </ProductFrame>
      </div>
    </div>
  );
}

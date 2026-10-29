"use client";

import * as React from "react";
import type { BoardCard, BoardColumn } from "@/components/app/kanban";
import { cn } from "@/lib/utils";
import { DemoBoard } from "./demo-board";
import { ProductFrame } from "./product-frame";

type Board = { columns: BoardColumn[]; cards: BoardCard[] };

const SCOPES = {
  personal: {
    label: "Personal",
    path: "/platform/personal",
    audience: "For one person tracking their own work.",
    facts: [
      "A private board, ready the moment you subscribe",
      "Three steps: Queued, Active, Done",
      "Every finished task adds to your own history and metrics",
      "Nothing to set up",
    ],
  },
  organisation: {
    label: "Organisation",
    path: "/platform/org/studio/board",
    audience: "For a team working on shared projects.",
    facts: [
      "Shared boards for every project",
      "A Review step before work counts as done",
      "Tasks assigned to teammates",
      "Team metrics that show progress, never rankings",
    ],
  },
} as const;

type Scope = keyof typeof SCOPES;

/**
 * The two workspace types, each shown as the product's own board. Drag a card, or use
 * its ⋯ menu, to move it; reaching Done records a commit.
 */
export function WorkspaceScope({ boards, doneWindowDays }: { boards: Record<Scope, Board>; doneWindowDays: number }) {
  const [scope, setScope] = React.useState<Scope>("personal");
  // A new key remounts the board, restoring its starting cards
  const [round, setRound] = React.useState(0);
  const config = SCOPES[scope];

  return (
    <div className="space-y-14">
      {/* Who it is for and what you get; the board below gets the full width */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <div role="radiogroup" aria-label="Workspace type" className="inline-flex rounded-full border border-white/[0.12] p-1">
            {(Object.keys(SCOPES) as Scope[]).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={scope === key}
                onClick={() => setScope(key)}
                className={cn(
                  "h-10 min-w-[7.5rem] rounded-full px-4 text-base transition-[background-color,color]",
                  scope === key ? "bg-[#F1F1EE] font-semibold text-[#090909]" : "text-[#A9A9A6] hover:text-white"
                )}
              >
                {SCOPES[key].label}
              </button>
            ))}
          </div>

          <p className="mt-8 text-xl leading-snug text-[#F4F4F2]">{config.audience}</p>
        </div>
        <ul className="grid gap-x-10 gap-y-3 self-end text-base text-[#A9A9A6] sm:grid-cols-2">
          {config.facts.map((fact) => (
            <li key={fact} className="flex gap-3">
              <svg viewBox="0 0 12 12" aria-hidden="true" className="mt-[0.4em] size-3 shrink-0 text-[#F4F4F2]">
                <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              {fact}
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-base text-[#F4F4F2]">
            Try it: <span className="text-[#A9A9A6]">drag a card to Done, or use its ⋯ menu.</span>
          </p>
          <button type="button" onClick={() => setRound((r) => r + 1)} className="text-sm text-[#A9A9A6] underline underline-offset-4 hover:text-white">
            Reset board
          </button>
        </div>
        <ProductFrame path={config.path} caption={`${config.label} board in the State app, with demo tasks`}>
          <DemoBoard key={`${scope}-${round}`} {...boards[scope]} showAssignee={scope === "organisation"} doneWindowDays={doneWindowDays} />
        </ProductFrame>
      </div>
    </div>
  );
}

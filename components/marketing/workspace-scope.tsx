"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SCOPES = {
  personal: {
    label: "Personal",
    note: "One private board, created the moment you subscribe. Three columns. Nothing to configure.",
    columns: [
      { name: "Backlog", tasks: ["Read chapter 7 of OS", "Update documentation"] },
      { name: "Active", tasks: ["Finish RelayDB query parser", "Review paper"] },
      { name: "Done", tasks: ["API schema", "Database migration"] },
    ],
  },
  organisation: {
    label: "Organisation",
    note: "Shared boards with a review stage, assignees and team metrics. Contribution is visible in context, never ranked.",
    columns: [
      { name: "Backlog", tasks: ["Rate limiting (AK)", "Billing export (IS)"] },
      { name: "Active", tasks: ["As-of join tests (PK)", "Vector execution (AK)"] },
      { name: "Review", tasks: ["Auth middleware (IS)"] },
      { name: "Done", tasks: ["Temporal indexing (PK)", "Landing page (IS)"] },
    ],
  },
} as const;

type Scope = keyof typeof SCOPES;

export function WorkspaceScope() {
  const [scope, setScope] = React.useState<Scope>("personal");
  const current = SCOPES[scope];

  return (
    <div>
      <div role="radiogroup" aria-label="Workspace" className="inline-flex rounded-full border border-white/[0.12] p-1">
        {(Object.keys(SCOPES) as Scope[]).map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={scope === key}
            onClick={() => setScope(key)}
            className={cn(
              "h-9 min-w-[7.5rem] rounded-full px-4 text-sm transition-[background-color,color]",
              scope === key ? "bg-[#F1F1EE] font-semibold text-[#090909]" : "text-[#A9A9A6] hover:text-white"
            )}
          >
            {SCOPES[key].label}
          </button>
        ))}
      </div>
      <p className="mt-5 max-w-[52ch] text-sm leading-relaxed text-[#A9A9A6]">{current.note}</p>

      <div
        className="mt-10 grid gap-x-6 gap-y-8"
        style={{ gridTemplateColumns: `repeat(${current.columns.length}, minmax(0, 1fr))` }}
      >
        {current.columns.map((column) => (
          <div key={column.name} className="min-w-0">
            <p className="flex items-baseline justify-between border-b border-white/[0.08] pb-2 text-xs text-[#6F6F6B]">
              <span>{column.name}</span>
              <span className="tabular-nums">{column.tasks.length}</span>
            </p>
            <ul className="mt-3 space-y-2.5">
              {column.tasks.map((task) => (
                <li key={task} className="flex min-w-0 items-center gap-2 text-sm text-[#D6D6D3]">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      column.name === "Done" ? "bg-[#F4F4F2]" : "border border-white/40"
                    )}
                  />
                  <span className="truncate">{task}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

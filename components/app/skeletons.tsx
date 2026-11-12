import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Loading skeletons that mirror the final layout (header, measure row, panels or board)
 * so content swaps in without layout shift. Faint pulse; static under reduced motion.
 */
function Bar({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block animate-pulse rounded-[6px] bg-black/[0.05]", className)} />;
}

function HeaderSkeleton() {
  return (
    <div className="space-y-3">
      <Bar className="h-3 w-24" />
      <Bar className="h-10 w-56" />
      <Bar className="h-3.5 w-80 max-w-full" />
    </div>
  );
}

function PanelSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("app-panel space-y-4 p-5", className)}>
      <Bar className="h-3 w-28" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Bar className="size-3 rounded-full" />
          <Bar className={cn("h-3.5", i % 2 ? "w-1/2" : "w-2/3")} />
          <Bar className="ml-auto h-3 w-10" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-8">
      <HeaderSkeleton />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="app-panel space-y-4 p-5">
            <Bar className="h-3 w-20" />
            <Bar className="h-8 w-24" />
            <Bar className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <PanelSkeleton rows={5} />
        <PanelSkeleton rows={5} />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function BoardSkeleton({ columns = 3 }: { columns?: number }) {
  return (
    <div role="status" aria-label="Loading board" className="space-y-8">
      <HeaderSkeleton />
      <div>
        {/* Sort bar */}
        <div className="app-panel mb-5 flex h-14 items-center gap-3 rounded-[20px] px-4">
          <Bar className="h-3 w-10" />
          <Bar className="h-3 w-16" />
        </div>
        <div className="grid gap-5 md:grid-flow-col md:auto-cols-[minmax(15rem,1fr)]">
          {Array.from({ length: columns }, (_, c) => (
            <div key={c} className="app-panel space-y-3 p-3">
              <Bar className="mx-1 mb-1 h-3 w-20" />
              {Array.from({ length: 4 - (c % 2) }, (_, i) => (
                <div key={i} className="app-card space-y-3 p-3.5">
                  <Bar className="h-3.5 w-3/4" />
                  <Bar className="h-3 w-1/3" />
                  <Bar className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

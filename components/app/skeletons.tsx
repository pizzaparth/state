import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Loading skeletons that mirror the final layout (header, measure row, panels or board)
 * so content swaps in without layout shift. Faint pulse; static under reduced motion.
 */
function Bar({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block animate-pulse rounded-[6px] bg-black/[0.05]", className)} />;
}

export function HeaderSkeleton() {
  return (
    <div className="space-y-3">
      <Bar className="h-3 w-24" />
      <Bar className="h-10 w-56" />
      <Bar className="h-3.5 w-80 max-w-full" />
    </div>
  );
}

export function PanelSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
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

function Tiles({ n = 4 }: { n?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={cn("space-y-4 p-5", i === 0 ? "rounded-[24px] bg-accent/20" : "app-panel")}>
          <Bar className="h-3 w-20" />
          <Bar className="h-8 w-24" />
          <Bar className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

function Loading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-label={label} className="space-y-8">
      <HeaderSkeleton />
      {children}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Today: the instrument and capture side by side, then two columns of lists. */
export function TodaySkeleton() {
  return (
    <Loading label="Loading Today">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-6 rounded-[28px] bg-accent/20 p-6">
          <Bar className="h-3 w-28" />
          <Bar className="h-20 w-40" />
          <Bar className="h-10 w-full" />
        </div>
        <div className="app-panel space-y-4 p-5">
          <Bar className="h-3 w-20" />
          <Bar className="h-12 w-full rounded-[18px]" />
          <Bar className="h-3 w-48" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <PanelSkeleton rows={3} />
          <PanelSkeleton rows={4} />
        </div>
        <div className="space-y-5">
          <PanelSkeleton rows={3} />
          <PanelSkeleton rows={4} />
        </div>
      </div>
    </Loading>
  );
}

/** Inbox: the capture panel, then the list. */
export function InboxSkeleton() {
  return (
    <Loading label="Loading Inbox">
      <div className="app-panel space-y-4 p-5">
        <Bar className="h-3 w-20" />
        <Bar className="h-12 w-full rounded-[18px]" />
      </div>
      <PanelSkeleton rows={6} />
    </Loading>
  );
}

/** Metrics: period control, anchors, eight tiles, a chart. */
export function MetricsSkeleton() {
  return (
    <Loading label="Loading Metrics">
      <Bar className="h-10 w-96 max-w-full rounded-full" />
      <Bar className="h-10 w-80 max-w-full rounded-full" />
      <Tiles />
      <Tiles />
      <div className="app-panel space-y-4 p-5">
        <Bar className="h-3 w-32" />
        <Bar className="h-56 w-full" />
      </div>
    </Loading>
  );
}

/** History: the filter row, then the ledger. */
export function HistorySkeleton() {
  return (
    <Loading label="Loading History">
      <div className="app-panel flex h-14 items-center gap-3 rounded-[20px] px-4">
        <Bar className="h-8 w-48 rounded-full" />
        <Bar className="h-8 w-28 rounded-full" />
        <Bar className="h-8 w-28 rounded-full" />
      </div>
      <PanelSkeleton rows={10} />
    </Loading>
  );
}

/** Activity: range control, graph, four tiles, a week's ledger. */
export function ActivitySkeleton() {
  return (
    <Loading label="Loading Activity">
      <div className="app-panel space-y-4 p-5">
        <Bar className="h-3 w-32" />
        <Bar className="h-36 w-full" />
      </div>
      <Tiles />
      <PanelSkeleton rows={6} />
    </Loading>
  );
}

/** Projects: the table. */
export function ProjectsSkeleton() {
  return (
    <Loading label="Loading Projects">
      <div className="app-panel space-y-4 p-5">
        <Bar className="h-3 w-24" />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr_repeat(5,minmax(0,1fr))] items-center gap-3">
            <Bar className="h-3.5 w-3/4" />
            <Bar className="h-5 w-16 rounded-full" />
            {Array.from({ length: 5 }, (_, j) => (
              <Bar key={j} className="ml-auto h-3 w-8" />
            ))}
          </div>
        ))}
      </div>
    </Loading>
  );
}

import * as React from "react";
import { ExecutionGraph } from "@/components/execution";
import { type ExecutionCell } from "@/lib/execution";

export default function ActivityPage() {
  // Scaffolding placeholder for cells
  const mockCells: ExecutionCell[] = Array.from({ length: 90 }, (_, i) => ({
    date: `2026-${String(Math.floor(i / 30) + 8).padStart(2, "0")}-${String((i % 30) + 1).padStart(2, "0")}`,
    commitsCount: 0,
    tasksCompleted: 0,
    executionValue: 0,
    intensity: 0,
  }));

  return (
    <div className="space-y-8">
      <div>
        <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
          Execution Matrix
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          Activity
        </h1>
        <p className="text-xs text-[#5F5F5B] mt-1">
          Quantitative density of executed work across the past 90 days.
        </p>
      </div>

      <ExecutionGraph cells={mockCells} title="Last 90 Days Execution" />

      <div className="bg-[#DEDEDA] rounded-card p-6 shadow-neu-raised-sm space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#5F5F5B] pb-3 border-b border-black/5">
          Recent Execution Flow
        </h2>
        <div className="py-8 text-center text-xs text-[#8B8B86]">
          Execution events will appear in real time as tasks are moved to done or commits are logged.
        </div>
      </div>
    </div>
  );
}

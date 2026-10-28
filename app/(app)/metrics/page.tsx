import * as React from "react";
import { MetricCard } from "@/components/metrics";

export default function MetricsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-black/5">
        <div>
          <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
            Quantitative Analysis
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
            Metrics / 30D
          </h1>
          <p className="text-xs text-[#5F5F5B] mt-1">
            Explainable mathematical indicators of output, velocity, and delivery cadence.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-medium text-[#5F5F5B] bg-[#D2D2CE] px-3 py-1.5 rounded-control shadow-neu-inset-sm">
            Period: Last 30 Days
          </span>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Total Execution"
          value="0"
          subtext="Σ completed task & manual commit weights"
        />
        <MetricCard
          label="Tasks Completed"
          value="0"
          subtext="Closed work units"
        />
        <MetricCard
          label="Completion Ratio"
          value="0.0"
          unit="%"
          subtext="Completed vs planned items"
        />
        <MetricCard
          label="Median Cycle Time"
          value="—"
          unit="hrs"
          subtext="Active state to completion"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <MetricCard
          label="Rolling Velocity"
          value="0.00"
          unit="/ day"
          subtext="Execution output per day"
        />
        <MetricCard
          label="Throughput"
          value="0.0"
          unit="tasks / wk"
          subtext="Completed tasks per week"
        />
        <MetricCard
          label="Consistency"
          value="0"
          unit="active days"
          subtext="Active days / 30 eligible days"
        />
      </div>
    </div>
  );
}

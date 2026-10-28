import * as React from "react";

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
}

export function MetricCard({ label, value, unit, subtext }: MetricCardProps) {
  return (
    <div className="bg-[#DEDEDA] p-5 rounded-card shadow-neu-raised-sm flex flex-col justify-between">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#5F5F5B]">
        {label}
      </span>
      <div className="my-3 flex items-baseline space-x-1">
        <span className="text-3xl font-bold font-mono text-[#171717] tabular-nums">
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-[#5F5F5B]">{unit}</span>}
      </div>
      {subtext && <p className="text-xs text-[#8B8B86]">{subtext}</p>}
    </div>
  );
}

import * as React from "react";
import { type ExecutionCell } from "@/lib/execution";

export interface ExecutionGraphProps {
  cells: ExecutionCell[];
  title?: string;
}

export function ExecutionGraph({ cells, title = "Execution Graph" }: ExecutionGraphProps) {
  const intensityBg = {
    0: "bg-[#D2D2CE]",
    1: "bg-[#B8B8B4]",
    2: "bg-[#80807C]",
    3: "bg-[#454542]",
    4: "bg-[#171717]",
  };

  return (
    <div className="bg-[#DEDEDA] p-5 rounded-card shadow-neu-raised-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5F5F5B]">
          {title}
        </h3>
        <div className="flex items-center space-x-1 text-xs text-[#8B8B86]">
          <span>Less</span>
          <span className="w-2.5 h-2.5 rounded-sm bg-[#D2D2CE]" />
          <span className="w-2.5 h-2.5 rounded-sm bg-[#B8B8B4]" />
          <span className="w-2.5 h-2.5 rounded-sm bg-[#80807C]" />
          <span className="w-2.5 h-2.5 rounded-sm bg-[#454542]" />
          <span className="w-2.5 h-2.5 rounded-sm bg-[#171717]" />
          <span>More</span>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {cells.map((cell) => (
          <div
            key={cell.date}
            title={`${cell.date}: ${cell.executionValue} execution (${cell.commitsCount} commits)`}
            className={`w-3.5 h-3.5 rounded-sm transition-transform hover:scale-125 cursor-pointer shrink-0 ${
              intensityBg[cell.intensity]
            }`}
          />
        ))}
      </div>
    </div>
  );
}

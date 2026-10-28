import * as React from "react";

export interface KanbanColumnProps {
  id: string;
  name: string;
  taskCount: number;
  children?: React.ReactNode;
}

export function KanbanColumn({ name, taskCount, children }: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-80 shrink-0 bg-[#DEDEDA] rounded-card p-4 shadow-neu-raised-sm">
      <div className="flex items-center justify-between pb-3 border-b border-black/5 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5F5F5B]">
          {name}
        </h3>
        <span className="text-xs font-mono font-medium text-[#8B8B86] tabular-nums">
          {taskCount}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

import * as React from "react";
import { format } from "date-fns";

export interface CommitItemProps {
  id: string;
  message: string;
  projectName?: string;
  executionValue: number;
  createdAt: Date | string;
}

export function CommitItem({ message, projectName, executionValue, createdAt }: CommitItemProps) {
  const formattedTime = format(new Date(createdAt), "HH:mm");

  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-black/5 rounded-control transition-colors">
      <div className="flex items-center space-x-3 min-w-0">
        <span className="text-xs font-mono text-[#8B8B86] shrink-0 tabular-nums">
          {formattedTime}
        </span>
        <span className="w-2 h-2 rounded-full bg-[#171717] shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium text-[#171717] truncate">{message}</span>
        {projectName && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#D2D2CE] text-[#5F5F5B] shrink-0">
            {projectName}
          </span>
        )}
      </div>
      <span className="text-xs font-mono font-semibold text-[#171717] tabular-nums shrink-0 ml-4">
        +{executionValue}
      </span>
    </div>
  );
}

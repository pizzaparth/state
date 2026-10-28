import * as React from "react";
import { Filter, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HistoryPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-black/5">
        <div>
          <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
            Execution Ledger
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
            Commit History
          </h1>
          <p className="text-xs text-[#5F5F5B] mt-1">
            Canonical chronological record of completed work across projects and workspaces.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="raised" size="sm" className="text-xs">
            <Filter className="w-3.5 h-3.5 mr-1" />
            Filter
          </Button>
          <Button variant="raised" size="sm" className="text-xs">
            <Calendar className="w-3.5 h-3.5 mr-1" />
            Time Range
          </Button>
        </div>
      </div>

      <div className="bg-[#DEDEDA] rounded-card p-6 shadow-neu-raised-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-black/5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#5F5F5B]">
            Commits Ledger
          </h2>
          <span className="text-xs font-mono text-[#8B8B86]">0 commits</span>
        </div>

        <div className="py-16 text-center text-xs text-[#8B8B86]">
          No commits recorded yet. Moving tasks to Done or logging manual commits creates immutable ledger records.
        </div>
      </div>
    </div>
  );
}

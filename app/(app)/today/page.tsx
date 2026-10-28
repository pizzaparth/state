import * as React from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TodayPage() {
  const todayFormatted = format(new Date(), "dd MMM yyyy").toUpperCase();

  return (
    <div className="space-y-8">
      {/* Header & Target Summary */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-black/5">
        <div>
          <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
            {todayFormatted}
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
            Today
          </h1>
        </div>

        <div className="flex items-center space-x-6 bg-[#DEDEDA] px-5 py-3 rounded-card shadow-neu-raised-sm">
          <div>
            <span className="text-[10px] uppercase font-semibold text-[#8B8B86] block">
              Execution Target
            </span>
            <span className="text-xl font-bold font-mono text-[#171717] tabular-nums">
              12
            </span>
          </div>
          <div className="w-px h-8 bg-black/10" />
          <div>
            <span className="text-[10px] uppercase font-semibold text-[#8B8B86] block">
              Current Output
            </span>
            <span className="text-xl font-bold font-mono text-[#171717] tabular-nums">
              0
            </span>
          </div>
        </div>
      </div>

      {/* Quick Add Inset Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Capture task for today… (e.g. Implement caching #relaydb !high)"
          className="w-full h-12 pl-4 pr-24 text-sm bg-[#D2D2CE] text-[#171717] rounded-input shadow-neu-inset-sm placeholder:text-[#8B8B86] border border-transparent focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/20 transition-[border-color,box-shadow] touch-manipulation"
        />
        <div className="absolute right-2 top-2">
          <Button variant="raised" size="sm" className="h-8 px-3 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Work Sections: Active, Queued, Completed */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Section */}
        <div className="bg-[#DEDEDA] rounded-card p-5 shadow-neu-raised-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-black/5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#5F5F5B]">
              Active
            </h2>
            <span className="text-xs font-mono text-[#8B8B86]">0</span>
          </div>
          <div className="py-8 text-center text-xs text-[#8B8B86]">
            No active tasks. Capture above or pull from queued.
          </div>
        </div>

        {/* Queued Section */}
        <div className="bg-[#DEDEDA] rounded-card p-5 shadow-neu-raised-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-black/5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#5F5F5B]">
              Queued
            </h2>
            <span className="text-xs font-mono text-[#8B8B86]">0</span>
          </div>
          <div className="py-8 text-center text-xs text-[#8B8B86]">
            No queued items for today.
          </div>
        </div>

        {/* Completed Section */}
        <div className="bg-[#DEDEDA] rounded-card p-5 shadow-neu-raised-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-black/5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#5F5F5B]">
              Completed
            </h2>
            <span className="text-xs font-mono text-[#8B8B86]">0</span>
          </div>
          <div className="py-8 text-center text-xs text-[#8B8B86]">
            Completed work generates verified commits here.
          </div>
        </div>
      </div>
    </div>
  );
}

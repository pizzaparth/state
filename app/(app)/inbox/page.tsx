import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InboxPage() {
  return (
    <div className="space-y-8">
      <div>
        <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
          Rapid Capture
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          Inbox
        </h1>
        <p className="text-xs text-[#5F5F5B] mt-1">
          Capture tasks without deciding where they belong yet. Triage later into personal boards, projects, or organisation columns.
        </p>
      </div>

      {/* Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Capture anything… (Use #project or !priority)"
          className="w-full h-12 pl-4 pr-24 text-sm bg-[#D2D2CE] text-[#171717] rounded-input shadow-neu-inset-sm placeholder:text-[#8B8B86] border border-transparent focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/20 transition-[border-color,box-shadow] touch-manipulation"
        />
        <div className="absolute right-2 top-2">
          <Button variant="raised" size="sm" className="h-8 px-3 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Capture
          </Button>
        </div>
      </div>

      {/* Inbox List */}
      <div className="bg-[#DEDEDA] rounded-card p-6 shadow-neu-raised-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-black/5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#5F5F5B]">
            Captured Items
          </h2>
          <span className="text-xs font-mono text-[#8B8B86]">0 items</span>
        </div>
        <div className="py-12 text-center text-xs text-[#8B8B86]">
          Your inbox is clean. Every incoming idea or task captured here awaits triage.
        </div>
      </div>
    </div>
  );
}

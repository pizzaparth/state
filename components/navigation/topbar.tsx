"use client";

import * as React from "react";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TopbarProps {
  title?: string;
}

export function Topbar({ title = "Today" }: TopbarProps) {
  return (
    <header className="h-16 px-8 flex items-center justify-between border-b border-black/5 bg-[#D9D9D5]/60 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center space-x-4">
        <h1 className="text-lg font-bold text-[#171717]">{title}</h1>
      </div>

      <div className="flex items-center space-x-3">
        {/* Quick Search / Command Palette shortcut trigger */}
        <button
          type="button"
          className="flex items-center space-x-2 h-9 px-3 bg-[#D2D2CE] text-[#5F5F5B] rounded-control shadow-neu-inset-sm text-xs hover:text-[#171717] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black"
          aria-label="Search or open command palette"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search…</span>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-black/10 rounded font-mono">⌘K</kbd>
        </button>

        {/* Quick Commit Action */}
        <Button variant="inverse" size="sm" className="font-semibold text-xs tracking-wide">
          <Plus className="w-3.5 h-3.5 mr-1" />
          COMMIT
        </Button>
      </div>
    </header>
  );
}

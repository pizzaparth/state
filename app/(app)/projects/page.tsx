import * as React from "react";
import { Plus, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProjectsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-black/5">
        <div>
          <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
            Work
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
            Projects
          </h1>
          <p className="text-xs text-[#5F5F5B] mt-1">
            Group related tasks, boards, and execution metrics into distinct delivery streams.
          </p>
        </div>

        <Button variant="raised" size="sm" className="text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" />
          New Project
        </Button>
      </div>

      <div className="bg-[#DEDEDA] rounded-card p-8 shadow-neu-raised-sm text-center space-y-4">
        <FolderKanban className="w-10 h-10 text-[#8B8B86] mx-auto" />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-[#171717]">No projects created yet</h2>
          <p className="text-xs text-[#5F5F5B] max-w-sm mx-auto">
            Projects help group related tasks, track focused velocity, and isolate completion history.
          </p>
        </div>
      </div>
    </div>
  );
}

import * as React from "react";
import { KanbanColumn } from "@/components/board";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PersonalBoardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-black/5">
        <div>
          <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
            Workspace
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
            Personal Board
          </h1>
          <p className="text-xs text-[#5F5F5B] mt-1">
            Horizontal execution board for personal tasks and individual output.
          </p>
        </div>

        <Button variant="raised" size="sm" className="text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" />
          New Task
        </Button>
      </div>

      {/* Horizontal Kanban Columns */}
      <div className="flex gap-6 overflow-x-auto pb-6">
        <KanbanColumn id="backlog" name="Backlog" taskCount={0}>
          <div className="p-4 rounded-control bg-[#D2D2CE]/40 border border-dashed border-black/10 text-center text-xs text-[#8B8B86]">
            No backlog tasks
          </div>
        </KanbanColumn>

        <KanbanColumn id="active" name="Active" taskCount={0}>
          <div className="p-4 rounded-control bg-[#D2D2CE]/40 border border-dashed border-black/10 text-center text-xs text-[#8B8B86]">
            No active tasks
          </div>
        </KanbanColumn>

        <KanbanColumn id="done" name="Done" taskCount={0}>
          <div className="p-4 rounded-control bg-[#D2D2CE]/40 border border-dashed border-black/10 text-center text-xs text-[#8B8B86]">
            Completed tasks commit here
          </div>
        </KanbanColumn>
      </div>
    </div>
  );
}

import * as React from "react";
import { KanbanColumn } from "@/components/board";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function OrgBoardPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-black/5">
        <div>
          <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
            {orgSlug}
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
            Organisation Board
          </h1>
          <p className="text-xs text-[#5F5F5B] mt-1">
            Collaborative execution stream for team projects, reviews, and delivery throughput.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button variant="raised" size="sm" className="text-xs">
            <Users className="w-3.5 h-3.5 mr-1" />
            Members
          </Button>
          <Button variant="raised" size="sm" className="text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Task
          </Button>
        </div>
      </div>

      {/* Columns: Backlog -> Active -> Review -> Done */}
      <div className="flex gap-6 overflow-x-auto pb-6">
        <KanbanColumn id="org-backlog" name="Backlog" taskCount={0}>
          <div className="p-4 rounded-control bg-[#D2D2CE]/40 border border-dashed border-black/10 text-center text-xs text-[#8B8B86]">
            Team backlog items
          </div>
        </KanbanColumn>

        <KanbanColumn id="org-active" name="Active" taskCount={0}>
          <div className="p-4 rounded-control bg-[#D2D2CE]/40 border border-dashed border-black/10 text-center text-xs text-[#8B8B86]">
            Currently in progress
          </div>
        </KanbanColumn>

        <KanbanColumn id="org-review" name="Review" taskCount={0}>
          <div className="p-4 rounded-control bg-[#D2D2CE]/40 border border-dashed border-black/10 text-center text-xs text-[#8B8B86]">
            Pending review or verification
          </div>
        </KanbanColumn>

        <KanbanColumn id="org-done" name="Done" taskCount={0}>
          <div className="p-4 rounded-control bg-[#D2D2CE]/40 border border-dashed border-black/10 text-center text-xs text-[#8B8B86]">
            Completed team commits
          </div>
        </KanbanColumn>
      </div>
    </div>
  );
}

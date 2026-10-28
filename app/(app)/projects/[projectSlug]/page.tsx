import * as React from "react";

export default async function ProjectPage({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-black/5">
        <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
          Project
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          {projectSlug}
        </h1>
        <p className="text-xs text-[#5F5F5B] mt-1">
          Status, board, execution graph, commit history, and metrics for this project.
        </p>
      </div>
    </div>
  );
}

import * as React from "react";

export default async function OrganisationOverviewPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-black/5">
        <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
          Organisation
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          {orgSlug}
        </h1>
        <p className="text-xs text-[#5F5F5B] mt-1">
          Execution, commits, projects, and median cycle time for this organisation.
        </p>
      </div>
    </div>
  );
}

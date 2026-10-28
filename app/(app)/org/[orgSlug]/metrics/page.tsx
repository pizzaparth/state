import * as React from "react";

export default async function OrganisationMetricsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-black/5">
        <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
          {orgSlug}
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          Metrics
        </h1>
        <p className="text-xs text-[#5F5F5B] mt-1">
          Project throughput, completion, cycle time, and delivery history. Not a leaderboard.
        </p>
      </div>
    </div>
  );
}

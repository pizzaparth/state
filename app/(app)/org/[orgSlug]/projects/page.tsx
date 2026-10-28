import * as React from "react";

export default async function OrganisationProjectsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-black/5">
        <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
          {orgSlug}
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          Projects
        </h1>
        <p className="text-xs text-[#5F5F5B] mt-1">
          Shared projects in this organisation.
        </p>
      </div>

      <div className="bg-[#DEDEDA] rounded-card p-6 shadow-neu-raised-sm">
        <p className="py-8 text-center text-xs text-[#8B8B86]">
          No organisation projects yet.
        </p>
      </div>
    </div>
  );
}

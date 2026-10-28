import * as React from "react";

export default function OrganisationsPage() {
  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-black/5">
        <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
          Work
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          Organisations
        </h1>
        <p className="text-xs text-[#5F5F5B] mt-1">
          Organisations you own or belong to.
        </p>
      </div>

      <div className="bg-[#DEDEDA] rounded-card p-6 shadow-neu-raised-sm">
        <p className="py-8 text-center text-xs text-[#8B8B86]">
          No organisations yet. Create one or accept an invitation to begin team execution.
        </p>
      </div>
    </div>
  );
}

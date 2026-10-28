import * as React from "react";

export default async function OrganisationMembersPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-black/5">
        <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
          {orgSlug}
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          Members
        </h1>
        <p className="text-xs text-[#5F5F5B] mt-1">
          Members, roles, and pending invitations.
        </p>
      </div>
    </div>
  );
}

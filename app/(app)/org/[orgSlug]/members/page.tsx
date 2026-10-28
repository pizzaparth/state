import * as React from "react";
import { getOrgMembers, getPendingInvitations } from "@/db/queries";
import { getViewerOrg } from "@/lib/viewer";
import { formatDate, initials } from "@/lib/format";
import { Avatar, Chip, EmptyState, Panel } from "@/components/app/primitives";
import { OrgHeader } from "@/components/app/org-header";

export default async function OrganisationMembersPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { viewer, org } = await getViewerOrg(orgSlug);
  const [members, invitations] = await Promise.all([getOrgMembers(org.id, org.workspaceId), getPendingInvitations(org.id)]);

  return (
    <>
      <title>{`${org.name} members — State`}</title>
      <OrgHeader org={org} active="members" />
      <Panel title="Members" aside={`${members.length}`}>
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-base">
            <thead>
              <tr className="text-left text-[12px] font-semibold uppercase tracking-[0.12em] text-[#9A9A96]">
                <th scope="col" className="px-2 pb-2 font-semibold">Member</th>
                <th scope="col" className="px-2 pb-2 font-semibold">Role</th>
                <th scope="col" className="px-2 pb-2 font-semibold">Joined</th>
                <th scope="col" className="px-2 pb-2 text-right font-semibold">Open tasks</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-white/[0.08]">
                  <th scope="row" className="px-2 py-3 text-left font-normal">
                    <span className="flex items-center gap-3">
                      <Avatar name={m.name} initials={initials(m.name)} className="size-8 text-[13px]" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{m.name}</span>
                        <span className="block truncate text-sm text-[#85857F]">{m.email}</span>
                      </span>
                    </span>
                  </th>
                  <td className="px-2 py-3">
                    <Chip>{m.role}</Chip>
                  </td>
                  <td className="px-2 py-3 tabular-nums text-[#9A9A96]">{formatDate(m.joinedAt, viewer.tz, { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{m.openTasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Pending invitations" aside={`${invitations.length}`}>
        {invitations.length === 0 ? (
          <EmptyState title="None pending" />
        ) : (
          <ul className="divide-y divide-white/[0.08]">
            {invitations.map((i) => (
              <li key={i.email} className="flex items-center justify-between gap-4 py-3 text-base first:pt-0 last:pb-0">
                <span className="truncate">{i.email}</span>
                <span className="flex shrink-0 items-center gap-3 text-sm text-[#9A9A96]">
                  <Chip>{i.role}</Chip>
                  expires {formatDate(i.expiresAt, viewer.tz)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

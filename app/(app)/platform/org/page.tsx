import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { getViewer } from "@/lib/viewer";
import { NewOrganisation } from "@/components/app/organisation-dialog";
import { Chip, EmptyState, PageHeader, Panel } from "@/components/app/primitives";

export const metadata = { title: "Organisations" };

export default async function OrganisationsPage() {
  const viewer = await getViewer();
  const canCreate = false;
  return (
    <>
      <PageHeader
        label="Work"
        title="Organisations"
        actions={
          canCreate ? (
            <NewOrganisation />
          ) : (
            <Link href="/platform" className="inline-flex min-h-9 items-center text-sm text-[#9A9A96] underline-offset-4 hover:text-[#F2F2EF] hover:underline">
              Needs the Organisation plan
            </Link>
          )
        }
      />
      <Panel>
        {viewer.orgs.length === 0 ? (
          <EmptyState title="No teams yet" />
        ) : (
          <ul className="app-stagger -mx-3">
            {viewer.orgs.map((o) => (
              <li key={o.id}>
                <Link href={`/platform/org/${o.slug}` as Route} className="flex items-center justify-between gap-4 rounded-[12px] px-3 py-3 transition-colors hover:bg-white/[0.04]">
                  <span className="font-medium">{o.name}</span>
                  <Chip>{o.role}</Chip>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

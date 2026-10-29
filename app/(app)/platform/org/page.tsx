import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { getViewer } from "@/lib/viewer";
import { Chip, EmptyState, PageHeader, Panel } from "@/components/app/primitives";

export const metadata = { title: "Organisations — State" };

export default async function OrganisationsPage() {
  const viewer = await getViewer();
  return (
    <>
      <PageHeader label="Work" title="Organisations" />
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

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
      <PageHeader label="Work" title="Organisations" description="Teams you belong to. Each has shared boards, projects and team metrics." />
      <Panel>
        {viewer.orgs.length === 0 ? (
          <EmptyState title="No organisations">Accept an invitation, or create an organisation, to execute with a team.</EmptyState>
        ) : (
          <ul className="-mx-3">
            {viewer.orgs.map((o) => (
              <li key={o.id}>
                <Link href={`/org/${o.slug}` as Route} className="flex items-center justify-between gap-4 rounded-[12px] px-3 py-3 transition-colors hover:bg-black/[0.04]">
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

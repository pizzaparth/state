import * as React from "react";
import { getInbox, getProjects } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { EmptyState, PageHeader, Panel } from "@/components/app/primitives";
import { QuickCapture } from "@/components/app/quick-capture";
import { TaskRow, withParam } from "@/components/app/task-row";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();
  const [inbox, projects] = await Promise.all([
    getInbox(viewer.personalWorkspaceId),
    getProjects(viewer.personalWorkspaceId ? [viewer.personalWorkspaceId] : []),
  ]);
  const now = new Date();

  return (
    <>
      <PageHeader
        label="Capture"
        title="Inbox"
      />

      <Panel title="Capture">
        <QuickCapture projects={projects.map((p) => ({ slug: p.slug, name: p.name }))} autoFocus showRecent={false} />
        <p className="mt-2 px-2 font-mono text-sm text-[#85857F]">
          <span className="text-[#F2F2EF]">#project</span> to file · <span className="text-[#F2F2EF]">!high</span> to rank
        </p>
      </Panel>

      <Panel title="Captured" aside={`${inbox.length} to sort`}>
        {inbox.length === 0 ? (
          <EmptyState title="Inbox zero" />
        ) : (
          <ul className="app-stagger -mx-3">
            {inbox.map((t) => (
              <TaskRow key={t.id} task={t} tz={viewer.tz} now={now} href={withParam("/platform/inbox", params, "task", t.id)} />
            ))}
          </ul>
        )}
      </Panel>

      <Drawers params={params} viewer={viewer} />
    </>
  );
}

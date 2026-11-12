import * as React from "react";
import { getInbox } from "@/db/queries";
import { getCaptureProjects, getViewer } from "@/lib/viewer";
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
    getCaptureProjects(viewer),
  ]);
  const now = new Date();

  return (
    <>
      <PageHeader
        label="Capture"
        title="Inbox"
      />

      <Panel title="Capture">
        <QuickCapture projects={projects} tz={viewer.tz} autoFocus showRecent={false} />
        <p className="mt-2 px-2 font-mono text-sm text-[#71717A]">
          <span className="text-[#0A0A0A]">#project</span> to file · <span className="text-[#0A0A0A]">!high</span> to rank · <span className="text-[#0A0A0A]">fri</span> to date · <span className="text-[#0A0A0A]">@name</span> to assign
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

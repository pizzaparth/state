import * as React from "react";
import { getInbox, getProjects } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { EmptyState, PageHeader, Panel } from "@/components/app/primitives";
import { QuickCapture } from "@/components/app/quick-capture";
import { TaskRow, withParam } from "@/components/app/task-row";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "Inbox — State" };

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
        label="Rapid capture"
        title="Inbox"
        description="Write it down now, decide where it belongs later. Tasks here are not on any board yet."
      />

      <Panel title="Capture">
        <QuickCapture projects={projects.map((p) => ({ slug: p.slug, name: p.name }))} autoFocus />
        <dl className="mt-3 grid gap-x-8 gap-y-1 px-2 text-sm text-[#9A9A96] sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="font-mono text-[#F2F2EF]">#relaydb</dt>
            <dd>assigns a project by its slug</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-mono text-[#F2F2EF]">!high</dt>
            <dd>sets priority: !critical, !high, !medium, !low</dd>
          </div>
        </dl>
      </Panel>

      <Panel title="Captured" aside={`${inbox.length} to triage`}>
        {inbox.length === 0 ? (
          <EmptyState title="Inbox zero">Anything you capture appears here until you move it to a board or project.</EmptyState>
        ) : (
          <ul className="-mx-3">
            {inbox.map((t) => (
              <TaskRow key={t.id} task={t} tz={viewer.tz} now={now} href={withParam("/inbox", params, "task", t.id)} />
            ))}
          </ul>
        )}
      </Panel>

      <Drawers params={params} viewer={viewer} />
    </>
  );
}

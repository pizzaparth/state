import * as React from "react";
import { getBoardTargets, getInbox, getProjectOptions } from "@/db/queries";
import { getCaptureProjects, getViewer } from "@/lib/viewer";
import { dayKey } from "@/lib/format";
import { EmptyState, PageHeader, Panel } from "@/components/app/primitives";
import { QuickCapture } from "@/components/app/quick-capture";
import { TaskRow, withParam } from "@/components/app/task-row";
import { RowActions } from "@/components/app/row-actions";
import { InboxTriage } from "@/components/app/inbox-triage";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "Inbox" };

/** "4d", "3h", "now": time since capture. */
function age(createdAt: Date, now: Date): string {
  const hours = (now.getTime() - createdAt.getTime()) / 3_600_000;
  if (hours < 1) return "now";
  if (hours < 24) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default async function InboxPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();
  const ws = viewer.personalWorkspaceId;
  const [inbox, projects, options, targets] = await Promise.all([
    getInbox(ws),
    getCaptureProjects(viewer),
    ws ? getProjectOptions(ws, viewer.workspaceIds) : [],
    ws ? getBoardTargets(ws, viewer.workspaceIds) : [],
  ]);
  const now = new Date();
  const today = dayKey(now, viewer.tz);
  const columns = targets.flatMap((b) => b.columns.map((c) => ({ id: c.id, name: targets.length > 1 ? `${b.name}, ${c.name}` : c.name })));

  return (
    <>
      <PageHeader label="Capture" title="Inbox" />

      <Panel title="Capture">
        <QuickCapture projects={projects} tz={viewer.tz} autoFocus showRecent={false} draftKey="state:draft:inbox" />
        <p className="mt-2 px-2 font-mono text-sm text-[#71717A]">
          <span className="text-[#0A0A0A]">#project</span> · <span className="text-[#0A0A0A]">!high</span> · <span className="text-[#0A0A0A]">+4</span> ·{" "}
          <span className="text-[#0A0A0A]">fri</span> · <span className="text-[#0A0A0A]">~weekly</span> · <span className="text-[#0A0A0A]">\#</span> to keep
        </p>
      </Panel>

      <Panel title="Captured" aside={`${inbox.length} to sort · oldest first`}>
        {inbox.length === 0 ? (
          <EmptyState title="Inbox zero" />
        ) : (
          <InboxTriage projects={options} columns={columns} today={today}>
            <ul className="app-stagger -mx-3">
              {inbox.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  tz={viewer.tz}
                  now={now}
                  href={withParam("/platform/inbox", params, "task", t.id)}
                  age={age(t.createdAt, now)}
                  actions={<RowActions taskId={t.id} title={t.title} today={today} actions={["queue", "start", "delete"]} />}
                />
              ))}
            </ul>
          </InboxTriage>
        )}
      </Panel>

      <Drawers params={params} viewer={viewer} siblings={inbox.map((t) => t.id)} />
    </>
  );
}

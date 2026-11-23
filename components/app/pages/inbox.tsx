import * as React from "react";
import { getBoardTargets, getInbox, getProjectOptions } from "@/db/queries";
import { getCaptureProjects } from "@/lib/viewer-data";
import { dayKey } from "@/lib/format";
import { definePage, type PageContext } from "@/lib/pages/types";
import { EmptyState, PageHeader, Panel } from "@/components/app/primitives";
import { QuickCapture } from "@/components/app/quick-capture";
import { TaskRow, withParam } from "@/components/app/task-row";
import { RowActions } from "@/components/app/row-actions";
import { InboxTriage } from "@/components/app/inbox-triage";
import { Drawers, loadDrawers } from "@/components/app/drawers";

/** "4d", "3h", "now": time since capture. */
function age(createdAt: Date, now: Date): string {
  const hours = (now.getTime() - createdAt.getTime()) / 3_600_000;
  if (hours < 1) return "now";
  if (hours < 24) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

async function load({ viewer, params }: PageContext) {
  const ws = viewer.personalWorkspaceId;
  const loading = getInbox(ws);
  const [inbox, projects, options, targets, drawers] = await Promise.all([
    loading,
    getCaptureProjects(viewer),
    ws ? getProjectOptions(ws, viewer.workspaceIds) : [],
    ws ? getBoardTargets(ws, viewer.workspaceIds) : [],
    loadDrawers(params, viewer, loading.then((rows) => rows.map((t) => t.id))),
  ]);
  return { props: { viewer, params, inbox, projects, options, targets, drawers } };
}

type Props = Awaited<ReturnType<typeof load>>["props"];

function View({ viewer, params, inbox, projects, options, targets, drawers }: Props) {
  const now = new Date();
  const today = dayKey(now, viewer.tz);
  const columns = targets.flatMap((b) => b.columns.map((c) => ({ id: c.id, name: targets.length > 1 ? `${b.name}, ${c.name}` : c.name })));

  return (
    <>
      <PageHeader label="Capture" title="Inbox" />

      <Panel title="Capture">
        <QuickCapture projects={projects} tz={viewer.tz} autoFocus showRecent={false} draftKey="state:draft:inbox" />
        <p className="mt-2 px-2 font-mono text-sm text-[#4F5565]">
          <span className="text-[#0A0A0A]">#work</span> · <span className="text-[#0A0A0A]">!high</span> · <span className="text-[#0A0A0A]">+4</span> ·{" "}
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

      <Drawers data={drawers} tz={viewer.tz} />
    </>
  );
}

export default definePage({ load, View });

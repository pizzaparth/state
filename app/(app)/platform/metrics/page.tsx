import * as React from "react";
import { getViewer } from "@/lib/viewer";
import { getProjectOptions } from "@/db/queries";
import { PageHeader } from "@/components/app/primitives";
import { MetricsView, toPeriod } from "@/components/app/metrics-view";
import type { PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "Metrics" };

export default async function MetricsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();
  const projects = viewer.personalWorkspaceId ? await getProjectOptions(viewer.personalWorkspaceId, viewer.workspaceIds) : [];
  return (
    <>
      <PageHeader
        label="Numbers"
        title="Metrics"
      />
      <MetricsView
        scope={{ workspaceIds: viewer.workspaceIds, userId: viewer.id }}
        tz={viewer.tz}
        period={toPeriod(params.period)}
        basePath="/platform/metrics"
        objectiveWorkspaceIds={viewer.personalWorkspaceId ? [viewer.personalWorkspaceId] : []}
        objectiveControls={viewer.personalWorkspaceId ? { organisationId: null, projects } : null}
      />
    </>
  );
}

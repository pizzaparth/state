import * as React from "react";
import { getViewer } from "@/lib/viewer";
import { PageHeader } from "@/components/app/primitives";
import { MetricsView, toPeriod } from "@/components/app/metrics-view";
import type { PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "Metrics — State" };

export default async function MetricsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();
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
      />
    </>
  );
}

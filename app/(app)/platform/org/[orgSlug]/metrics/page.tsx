import * as React from "react";
import { getViewerOrg } from "@/lib/viewer";
import { MetricsView, toPeriod } from "@/components/app/views";
import { OrgHeader } from "@/components/app/org-header";
import type { PageSearchParams } from "@/components/app/drawers";

export default async function OrganisationMetricsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: PageSearchParams;
}) {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  const { viewer, org } = await getViewerOrg(orgSlug);
  return (
    <>
      <title>{`${org.name} metrics — State`}</title>
      <OrgHeader org={org} active="metrics" />
      <MetricsView
        scope={{ workspaceIds: [org.workspaceId] }}
        tz={viewer.tz}
        period={toPeriod(query.period)}
        basePath={`/platform/org/${org.slug}/metrics`}
        objectiveWorkspaceIds={[org.workspaceId]}
      />
    </>
  );
}

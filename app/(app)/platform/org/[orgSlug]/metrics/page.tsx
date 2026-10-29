import * as React from "react";
import { getViewerOrg } from "@/lib/viewer";
import { getProjectOptions } from "@/db/queries";
import { WRITE_ROLES } from "@/lib/authz";
import { MetricsView, toPeriod } from "@/components/app/metrics-view";
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
  const writable = (WRITE_ROLES as readonly string[]).includes(org.role);
  const projects = writable ? await getProjectOptions(org.workspaceId, viewer.workspaceIds) : [];
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
        objectiveControls={writable ? { organisationId: org.id, projects } : null}
      />
    </>
  );
}

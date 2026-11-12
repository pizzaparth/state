import * as React from "react";
import { cookies } from "next/headers";
import { getEligibleDays, getProjectOptions } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { dayKey } from "@/lib/format";
import { PageHeader } from "@/components/app/primitives";
import { MetricsView, PERIODS, toRange } from "@/components/app/metrics-view";
import { MetricsControls } from "@/components/app/metrics-controls";
import { METRIC_SECTIONS, METRICS_COLLAPSED_COOKIE, MetricAnchors } from "@/components/app/metric-sections";
import { MetricDrawer, ObjectiveDrawer } from "@/components/app/metric-drawer";
import { withParam } from "@/components/app/task-row";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "Metrics" };

export default async function MetricsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();
  const projects = viewer.personalWorkspaceId ? await getProjectOptions(viewer.personalWorkspaceId, viewer.workspaceIds) : [];
  const project = params.project ? projects.find((p) => p.slug === params.project) : undefined;
  const scope = { workspaceIds: viewer.workspaceIds, userId: viewer.id, projectId: project?.id };
  const today = dayKey(new Date(), viewer.tz);
  const allDays = await getEligibleDays({ workspaceIds: viewer.workspaceIds, userId: viewer.id }, viewer.tz, 1826);
  const range = toRange(params, today, allDays);
  const collapsed = decodeURIComponent((await cookies()).get(METRICS_COLLAPSED_COOKIE)?.value ?? "")
    .split(",")
    .filter(Boolean);
  const href = (key: string) => (value: string) => withParam("/platform/metrics", params, key, value);

  return (
    <>
      <PageHeader label={project ? project.name : "Numbers"} title="Metrics" />
      <MetricsControls periods={Object.keys(PERIODS)} active={range.key} from={range.from} to={range.to} projects={projects.map((p) => ({ slug: p.slug, name: p.name }))} project={project?.slug ?? null} />
      <MetricAnchors sections={METRIC_SECTIONS} />
      <MetricsView
        scope={scope}
        tz={viewer.tz}
        range={range}
        metricHref={href("metric")}
        objectiveHref={href("objective")}
        objectiveWorkspaceIds={viewer.personalWorkspaceId ? [viewer.personalWorkspaceId] : []}
        objectiveControls={viewer.personalWorkspaceId ? { projects, tz: viewer.tz } : null}
        collapsed={collapsed}
        weekStartsOn={viewer.preferences.weekStart}
      />
      {params.metric && <MetricDrawer metric={params.metric} scope={scope} tz={viewer.tz} range={range} commitHref={href("commit")} />}
      {params.objective && /^[A-Za-z0-9_-]{1,64}$/.test(params.objective) && (
        <ObjectiveDrawer objectiveId={params.objective} workspaceIds={viewer.personalWorkspaceId ? [viewer.personalWorkspaceId] : []} tz={viewer.tz} />
      )}
      <Drawers params={params} viewer={viewer} />
    </>
  );
}

import * as React from "react";
import { getEligibleDays, getProjectOptions } from "@/db/queries";
import { dayKey } from "@/lib/format";
import { definePage, type PageContext } from "@/lib/pages/types";
import { PageHeader } from "@/components/app/primitives";
import { loadMetricsData, MetricsReport, PERIODS, toRange } from "@/components/app/metrics-view";
import { MetricsControls } from "@/components/app/metrics-controls";
import { METRIC_SECTIONS, MetricAnchors } from "@/components/app/metric-sections";
import { loadMetricDrawer, loadObjectiveDrawer, MetricDrawer, ObjectiveDrawer } from "@/components/app/metric-drawer";
import { withParam } from "@/components/app/task-row";
import { Drawers, loadDrawers } from "@/components/app/drawers";

async function load({ viewer, params, cookies }: PageContext) {
  const projects = viewer.personalWorkspaceId ? await getProjectOptions(viewer.personalWorkspaceId, viewer.workspaceIds) : [];
  const project = params.project ? projects.find((p) => p.slug === params.project) : undefined;
  const scope = { workspaceIds: viewer.workspaceIds, userId: viewer.id, projectId: project?.id };
  const today = dayKey(new Date(), viewer.tz);
  const allDays = await getEligibleDays({ workspaceIds: viewer.workspaceIds, userId: viewer.id }, viewer.tz, 1826);
  const range = toRange(params, today, allDays);
  const collapsed = decodeURIComponent(cookies.metrics_collapsed ?? "")
    .split(",")
    .filter(Boolean);
  const objectiveWorkspaceIds = viewer.personalWorkspaceId ? [viewer.personalWorkspaceId] : [];
  const [report, metricDrawer, objectiveDrawer, drawers] = await Promise.all([
    loadMetricsData({ scope, tz: viewer.tz, range, objectiveWorkspaceIds, archivedObjectives: Boolean(viewer.personalWorkspaceId) }),
    params.metric ? loadMetricDrawer(params.metric, scope, viewer.tz, range) : null,
    params.objective && /^[A-Za-z0-9_-]{1,64}$/.test(params.objective) ? loadObjectiveDrawer(params.objective, objectiveWorkspaceIds, viewer.tz) : null,
    loadDrawers(params, viewer),
  ]);
  return { props: { viewer, params, projects, project, range, collapsed, report, metricDrawer, objectiveDrawer, drawers } };
}

type Props = Awaited<ReturnType<typeof load>>["props"];

function View({ viewer, params, projects, project, range, collapsed, report, metricDrawer, objectiveDrawer, drawers }: Props) {
  const href = (key: string) => (value: string) => withParam("/platform/metrics", params, key, value);
  return (
    <>
      <PageHeader label={project ? project.name : "Numbers"} title="Metrics" />
      <MetricsControls periods={Object.keys(PERIODS)} active={range.key} from={range.from} to={range.to} projects={projects.map((p) => ({ slug: p.slug, name: p.name }))} project={project?.slug ?? null} />
      <MetricAnchors sections={METRIC_SECTIONS} />
      <MetricsReport
        metrics={report.metrics}
        series={report.series}
        objectives={report.objectives}
        archivedObjectives={report.archived}
        objectiveControls={viewer.personalWorkspaceId ? { projects, tz: viewer.tz } : null}
        tz={viewer.tz}
        days={range.days}
        metricHref={href("metric")}
        objectiveHref={href("objective")}
        collapsed={collapsed}
        weekStartsOn={viewer.preferences.weekStart}
      />
      {metricDrawer && <MetricDrawer data={metricDrawer} tz={viewer.tz} range={range} commitHref={href("commit")} />}
      {objectiveDrawer && <ObjectiveDrawer data={objectiveDrawer} tz={viewer.tz} />}
      <Drawers data={drawers} tz={viewer.tz} />
    </>
  );
}

export default definePage({ load, View });

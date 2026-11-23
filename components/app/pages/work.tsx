import * as React from "react";
import { getProjectBySlug } from "@/db/queries";
import { getCaptureProjects } from "@/lib/viewer-data";
import { definePage, type PageContext } from "@/lib/pages/types";
import { Chip, PageHeader } from "@/components/app/primitives";
import { ArchivedNotice, loadProjectView, ProjectView } from "@/components/app/views";
import { withParam } from "@/components/app/task-row";
import { Drawers, loadDrawers } from "@/components/app/drawers";
import { ProjectActions } from "@/components/app/project-dialog";

async function load({ viewer, params, route }: PageContext) {
  const project = viewer.personalWorkspaceId ? await getProjectBySlug(viewer.personalWorkspaceId, route.workSlug ?? "") : null;
  if (!project) return { notFound: true as const };
  const tab: "open" | "done" = params.tab === "done" ? "done" : "open";
  const page = Math.max(0, Math.min(1000, Number(params.page) || 0));
  const loading = loadProjectView({ workspaceIds: [project.workspaceId], projectId: project.id }, viewer.tz, tab, page);
  const [view, capture, drawers] = await Promise.all([
    loading,
    getCaptureProjects(viewer),
    loadDrawers(params, viewer, loading.then((v) => v.open.map((t) => t.id))),
  ]);
  return { props: { viewer, params, slug: route.workSlug ?? "", project, tab, page, view, capture, drawers } };
}

type Props = Extract<Awaited<ReturnType<typeof load>>, { props: unknown }>["props"];

function View({ viewer, params, slug, project, tab, page, view, capture, drawers }: Props) {
  const base = `/platform/work/${slug}`;
  return (
    <>
      <title>{`${project.name} — State`}</title>
      <PageHeader
        label="Work"
        title={project.name}
        description={project.description}
        actions={
          <>
            <Chip>{project.archivedAt ? "archived" : project.status}</Chip>
            <ProjectActions
              project={{ id: project.id, name: project.name, slug: project.slug, description: project.description, status: project.status, archived: Boolean(project.archivedAt) }}
            />
          </>
        }
      />
      {project.archivedAt && <ArchivedNotice archivedAt={project.archivedAt} tz={viewer.tz} />}
      <ProjectView
        project={{ ...project, archived: Boolean(project.archivedAt) }}
        data={view}
        tz={viewer.tz}
        taskHref={(id) => withParam(base, params, "task", id)}
        commitHref={(id) => withParam(base, params, "commit", id)}
        tab={tab}
        page={page}
        tabHref={(t, p) => `${base}${t === "done" ? `?tab=done${p ? `&page=${p}` : ""}` : ""}`}
        capture={{ projects: capture }}
      />
      <Drawers data={drawers} tz={viewer.tz} />
    </>
  );
}

export default definePage({ load, View });

import * as React from "react";
import { notFound } from "next/navigation";
import { getOpenTasks, getProjectBySlug } from "@/db/queries";
import { getCaptureProjects, getViewer } from "@/lib/viewer";
import { BackLink, Chip, PageHeader } from "@/components/app/primitives";
import { ProjectView } from "@/components/app/views";
import { withParam } from "@/components/app/task-row";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";
import { ProjectActions } from "@/components/app/project-dialog";
import { ArchivedNotice } from "@/components/app/views";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectSlug: string }>;
  searchParams: PageSearchParams;
}) {
  const [{ projectSlug }, query] = await Promise.all([params, searchParams]);
  const viewer = await getViewer();
  const project = viewer.personalWorkspaceId ? await getProjectBySlug(viewer.personalWorkspaceId, projectSlug) : null;
  if (!project) notFound();
  const base = `/platform/projects/${projectSlug}`;

  return (
    <>
      <title>{`${project.name} — State`}</title>
      <BackLink href="/platform/projects">Projects</BackLink>
      <PageHeader
        label="Project"
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
        scope={{ workspaceIds: [project.workspaceId] }}
        tz={viewer.tz}
        taskHref={(id) => withParam(base, query, "task", id)}
        commitHref={(id) => withParam(base, query, "commit", id)}
        tab={query.tab === "done" ? "done" : "open"}
        page={Math.max(0, Math.min(1000, Number(query.page) || 0))}
        tabHref={(tab, page) => `${base}${tab === "done" ? `?tab=done${page ? `&page=${page}` : ""}` : ""}`}
        capture={{ projects: await getCaptureProjects(viewer) }}
      />
      <Drawers params={query} viewer={viewer} siblings={(await getOpenTasks({ workspaceIds: [project.workspaceId], projectId: project.id })).map((t) => t.id)} />
    </>
  );
}

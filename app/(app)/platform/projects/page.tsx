import * as React from "react";
import { getArchivedProjects, getProjects } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { PageHeader, Panel } from "@/components/app/primitives";
import { ArchivedProjects, ProjectTable } from "@/components/app/views";
import { NewProject } from "@/components/app/project-dialog";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const viewer = await getViewer();
  const [all, archived] = await Promise.all([getProjects(viewer.workspaceIds, viewer.tz), getArchivedProjects(viewer.workspaceIds)]);
  const personal = all.filter((p) => p.workspaceId === viewer.personalWorkspaceId);

  return (
    <>
      <PageHeader label="Work" title="Projects" />
      <Panel title="Personal" aside={<ProjectsAside count={personal.length} create={<NewProject />} />}>
        <ProjectTable projects={personal} hrefFor={(slug) => `/platform/projects/${slug}`} tz={viewer.tz} />
        <ArchivedProjects
          projects={archived.filter((p) => p.workspaceId === viewer.personalWorkspaceId)}
          hrefFor={(slug) => `/platform/projects/${slug}`}
          tz={viewer.tz}
        />
      </Panel>
    </>
  );
}

function ProjectsAside({ count, create }: { count: number; create: React.ReactNode }) {
  return (
    <span className="flex items-center gap-3">
      <span className="tabular-nums">{count === 1 ? "1 project" : `${count} projects`}</span>
      {create}
    </span>
  );
}

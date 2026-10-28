import * as React from "react";
import { getProjects } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { PageHeader, Panel } from "@/components/app/primitives";
import { ProjectTable } from "@/components/app/views";

export const metadata = { title: "Projects — State" };

export default async function ProjectsPage() {
  const viewer = await getViewer();
  const all = await getProjects(viewer.workspaceIds);
  const personal = all.filter((p) => p.workspaceId === viewer.personalWorkspaceId);

  return (
    <>
      <PageHeader label="Work" title="Projects" description="Related tasks grouped into delivery streams, each with its own history." />
      <Panel title="Personal" aside={`${personal.length} projects`}>
        <ProjectTable projects={personal} hrefFor={(slug) => `/projects/${slug}`} tz={viewer.tz} />
      </Panel>
      {viewer.orgs.map((org) => {
        const projects = all.filter((p) => p.workspaceId === org.workspaceId);
        return (
          <Panel key={org.id} title={org.name} aside={`${projects.length} projects`}>
            <ProjectTable projects={projects} hrefFor={(slug) => `/org/${org.slug}/projects/${slug}`} tz={viewer.tz} />
          </Panel>
        );
      })}
    </>
  );
}

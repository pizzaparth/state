import * as React from "react";
import { getArchivedProjects, getProjects } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { PageHeader, Panel } from "@/components/app/primitives";
import { ArchivedProjects, ProjectTable } from "@/components/app/views";
import { NewProject } from "@/components/app/project-dialog";
import { WRITE_ROLES } from "@/lib/authz";

export const metadata = { title: "Projects — State" };

export default async function ProjectsPage() {
  const viewer = await getViewer();
  const [all, archived] = await Promise.all([getProjects(viewer.workspaceIds), getArchivedProjects(viewer.workspaceIds)]);
  const personal = all.filter((p) => p.workspaceId === viewer.personalWorkspaceId);

  return (
    <>
      <PageHeader label="Work" title="Projects" description="Related tasks grouped into delivery streams, each with its own history." />
      <Panel title="Personal" aside={<ProjectsAside count={personal.length} create={<NewProject organisationId={null} workspaceName="Personal" />} />}>
        <ProjectTable projects={personal} hrefFor={(slug) => `/projects/${slug}`} tz={viewer.tz} />
        <ArchivedProjects
          projects={archived.filter((p) => p.workspaceId === viewer.personalWorkspaceId)}
          hrefFor={(slug) => `/projects/${slug}`}
          tz={viewer.tz}
        />
      </Panel>
      {viewer.orgs.map((org) => {
        const projects = all.filter((p) => p.workspaceId === org.workspaceId);
        return (
          <Panel
            key={org.id}
            title={org.name}
            aside={
              <ProjectsAside
                count={projects.length}
                create={(WRITE_ROLES as readonly string[]).includes(org.role) && <NewProject organisationId={org.id} workspaceName={org.name} />}
              />
            }
          >
            <ProjectTable projects={projects} hrefFor={(slug) => `/org/${org.slug}/projects/${slug}`} tz={viewer.tz} />
            <ArchivedProjects
              projects={archived.filter((p) => p.workspaceId === org.workspaceId)}
              hrefFor={(slug) => `/org/${org.slug}/projects/${slug}`}
              tz={viewer.tz}
            />
          </Panel>
        );
      })}
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

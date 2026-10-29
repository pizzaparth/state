import * as React from "react";
import { getProjects } from "@/db/queries";
import { getViewerOrg } from "@/lib/viewer";
import { Panel } from "@/components/app/primitives";
import { ProjectTable } from "@/components/app/views";
import { OrgHeader } from "@/components/app/org-header";
import { NewProject } from "@/components/app/new-project";
import { WRITE_ROLES } from "@/lib/authz";

export default async function OrganisationProjectsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { viewer, org } = await getViewerOrg(orgSlug);
  const projects = await getProjects([org.workspaceId]);
  return (
    <>
      <title>{`${org.name} projects — State`}</title>
      <OrgHeader org={org} active="projects" />
      <Panel
        aside={
          <span className="flex items-center gap-3">
            <span className="tabular-nums">{projects.length === 1 ? "1 project" : `${projects.length} projects`}</span>
            {(WRITE_ROLES as readonly string[]).includes(org.role) && <NewProject organisationId={org.id} workspaceName={org.name} />}
          </span>
        }
      >
        <ProjectTable projects={projects} hrefFor={(slug) => `/org/${org.slug}/projects/${slug}`} tz={viewer.tz} />
      </Panel>
    </>
  );
}

import * as React from "react";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/db/queries";
import { getViewerOrg } from "@/lib/viewer";
import { Chip, PageHeader } from "@/components/app/primitives";
import { ProjectView } from "@/components/app/views";
import { withParam } from "@/components/app/task-row";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export default async function OrganisationProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
  searchParams: PageSearchParams;
}) {
  const [{ orgSlug, projectSlug }, query] = await Promise.all([params, searchParams]);
  const { viewer, org } = await getViewerOrg(orgSlug);
  const project = await getProjectBySlug(org.workspaceId, projectSlug);
  if (!project) notFound();
  const base = `/org/${org.slug}/projects/${projectSlug}`;

  return (
    <>
      <title>{`${project.name} — ${org.name} — State`}</title>
      <PageHeader label={`${org.name} project`} title={project.name} description={project.description} actions={<Chip>{project.status}</Chip>} />
      <ProjectView
        project={project}
        scope={{ workspaceIds: [org.workspaceId] }}
        tz={viewer.tz}
        taskHref={(id) => withParam(base, query, "task", id)}
        commitHref={(id) => withParam(base, query, "commit", id)}
        showPeople
      />
      <Drawers params={query} viewer={viewer} />
    </>
  );
}

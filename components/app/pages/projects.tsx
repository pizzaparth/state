import * as React from "react";
import { getArchivedProjects, getProjects } from "@/db/queries";
import { definePage, type PageContext } from "@/lib/pages/types";
import { PageHeader, Panel } from "@/components/app/primitives";
import { ArchivedProjects, ProjectTable } from "@/components/app/views";
import { NewProject } from "@/components/app/project-dialog";

async function load({ viewer }: PageContext) {
  const [all, archived] = await Promise.all([getProjects(viewer.workspaceIds, viewer.tz), getArchivedProjects(viewer.workspaceIds)]);
  return {
    props: {
      tz: viewer.tz,
      personal: all.filter((p) => p.workspaceId === viewer.personalWorkspaceId),
      archived: archived.filter((p) => p.workspaceId === viewer.personalWorkspaceId),
    },
  };
}

type Props = Awaited<ReturnType<typeof load>>["props"];

function View({ tz, personal, archived }: Props) {
  return (
    <>
      <PageHeader label="Work" title="Projects" />
      <Panel title="Personal" aside={<ProjectsAside count={personal.length} create={<NewProject />} />}>
        <ProjectTable projects={personal} hrefFor={(slug) => `/platform/projects/${slug}`} tz={tz} />
        <ArchivedProjects projects={archived} hrefFor={(slug) => `/platform/projects/${slug}`} tz={tz} />
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

export default definePage({ load, View });

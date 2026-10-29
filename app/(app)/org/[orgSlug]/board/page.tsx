import * as React from "react";
import { getOrgBoardId } from "@/db/queries";
import { getViewerOrg } from "@/lib/viewer";
import { BoardView } from "@/components/app/board-view";
import { OrgHeader } from "@/components/app/org-header";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export default async function OrgBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: PageSearchParams;
}) {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  const { viewer, org } = await getViewerOrg(orgSlug);
  const boardId = await getOrgBoardId(org.workspaceId);

  return (
    <>
      <title>{`${org.name} board — State`}</title>
      <OrgHeader org={org} active="board" description="Work moves Queued → Active → Review → Done. Reaching Done records a commit for the assignee." />
      <BoardView boardId={boardId} viewer={viewer} params={query} basePath={`/org/${org.slug}/board`} showAssignee />
      <Drawers params={query} viewer={viewer} />
    </>
  );
}

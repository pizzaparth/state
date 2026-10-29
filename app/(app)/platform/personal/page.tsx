import * as React from "react";
import { getViewer } from "@/lib/viewer";
import { PageHeader } from "@/components/app/primitives";
import { BoardView } from "@/components/app/board-view";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "Personal board" };

export default async function PersonalBoardPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();
  return (
    <>
      <PageHeader
        label="Work"
        title="Personal"
      />
      <BoardView boardId={viewer.personalBoardId} viewer={viewer} params={params} basePath="/platform/personal" showAssignee={false} />
      <Drawers params={params} viewer={viewer} />
    </>
  );
}

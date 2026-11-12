import * as React from "react";
import { getViewer } from "@/lib/viewer";
import { PageHeader } from "@/components/app/primitives";
import { BoardView } from "@/components/app/board-view";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "Board" };

export default async function BoardPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();
  return (
    <>
      <PageHeader
        label="Work"
        title="Board"
      />
      <BoardView boardId={viewer.personalBoardId} viewer={viewer} params={params} basePath="/platform/board" showAssignee={false} />
      <Drawers params={params} viewer={viewer} />
    </>
  );
}

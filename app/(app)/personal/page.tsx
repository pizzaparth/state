import * as React from "react";
import { getViewer } from "@/lib/viewer";
import { PageHeader } from "@/components/app/primitives";
import { BoardView } from "@/components/app/board-view";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "Personal board — State" };

export default async function PersonalBoardPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();
  return (
    <>
      <PageHeader
        label="Work"
        title="Personal"
        description="Drag a task to the next column, or use its ••• menu. Reaching Done records a commit."
      />
      <BoardView boardId={viewer.personalBoardId} viewer={viewer} params={params} basePath="/personal" showAssignee={false} />
      <Drawers params={params} viewer={viewer} />
    </>
  );
}

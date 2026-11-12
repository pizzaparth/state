import * as React from "react";
import { cookies } from "next/headers";
import { BOARD_SORT_COOKIE, parseBoardSort } from "@/lib/board-sort";
import { getViewer } from "@/lib/viewer";
import { PageHeader } from "@/components/app/primitives";
import { BoardView } from "@/components/app/board-view";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "Board" };

export default async function BoardPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();
  // The URL wins (deep links); otherwise the sort last picked in this browser
  const sort = parseBoardSort(params.sort ?? (await cookies()).get(BOARD_SORT_COOKIE)?.value);
  return (
    <>
      <PageHeader
        label="Work"
        title="Board"
      />
      <BoardView boardId={viewer.personalBoardId} viewer={viewer} params={params} basePath="/platform/board" showAssignee={false} sort={sort} />
      <Drawers params={params} viewer={viewer} />
    </>
  );
}

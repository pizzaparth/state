import * as React from "react";
import { cookies } from "next/headers";
import { BOARD_SORT_COOKIE, parseBoardSort } from "@/lib/board-sort";
import { BOARD_FILTER_COOKIE, BOARD_FILTER_KEYS, parseBoardFilter } from "@/lib/board-filter";
import { getViewer } from "@/lib/viewer";
import { PageHeader } from "@/components/app/primitives";
import { BoardView } from "@/components/app/board-view";
import { Drawers, type PageSearchParams } from "@/components/app/drawers";

export const metadata = { title: "Board" };

export default async function BoardPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const viewer = await getViewer();
  // The URL wins (deep links); otherwise the sort last picked in this browser
  const jar = await cookies();
  const sort = parseBoardSort(params.sort ?? jar.get(BOARD_SORT_COOKIE)?.value);
  // Filter: from the URL when it names any filter, else the last one used here
  const filter = parseBoardFilter(BOARD_FILTER_KEYS.some((k) => params[k] !== undefined) ? params : decodeURIComponent(jar.get(BOARD_FILTER_COOKIE)?.value ?? ""));
  return (
    <>
      <PageHeader
        label="Work"
        title="Board"
      />
      <BoardView boardId={viewer.personalBoardId} viewer={viewer} params={params} basePath="/platform/board" sort={sort} filter={filter} />
      <Drawers params={params} viewer={viewer} />
    </>
  );
}

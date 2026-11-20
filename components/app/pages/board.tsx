import * as React from "react";
import { BOARD_SORT_COOKIE, parseBoardSort } from "@/lib/board-sort";
import { BOARD_FILTER_COOKIE, BOARD_FILTER_KEYS, parseBoardFilter } from "@/lib/board-filter";
import { getBoardTaskIds } from "@/db/queries";
import { definePage, type PageContext } from "@/lib/pages/types";
import { PageHeader } from "@/components/app/primitives";
import { BoardView, loadBoardView } from "@/components/app/board-view";
import { Drawers, loadDrawers } from "@/components/app/drawers";

async function load({ viewer, params, cookies }: PageContext) {
  // The URL wins (deep links); otherwise the sort last picked in this browser
  const sort = parseBoardSort(params.sort ?? cookies[BOARD_SORT_COOKIE]);
  // Filter: from the URL when it names any filter, else the last one used here
  const filter = parseBoardFilter(BOARD_FILTER_KEYS.some((k) => params[k] !== undefined) ? params : decodeURIComponent(cookies[BOARD_FILTER_COOKIE] ?? ""));
  const [board, siblings] = await Promise.all([
    loadBoardView({ boardId: viewer.personalBoardId, viewer, params, basePath: "/platform/board", sort, filter, doneWindowDays: viewer.preferences.doneWindow }),
    params.task && viewer.personalBoardId ? getBoardTaskIds(viewer.personalBoardId, viewer.workspaceIds) : undefined,
  ]);
  const drawers = await loadDrawers(params, viewer, siblings);
  return { props: { board, drawers, tz: viewer.tz } };
}

type Props = Awaited<ReturnType<typeof load>>["props"];

function View({ board, drawers, tz }: Props) {
  return (
    <>
      <PageHeader label="Work" title="Board" />
      <BoardView data={board} />
      <Drawers data={drawers} tz={tz} />
    </>
  );
}

export default definePage({ load, View });

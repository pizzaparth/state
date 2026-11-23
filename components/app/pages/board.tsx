import * as React from "react";
import { BOARD_FILTER_COOKIE, BOARD_FILTER_KEYS, COLUMN_FILTER_COOKIE, parseBoardFilter, parseColumnFilters } from "@/lib/board-filter";
import { getBoardTaskIds } from "@/db/queries";
import { definePage, type PageContext } from "@/lib/pages/types";
import { PageHeader } from "@/components/app/primitives";
import { BoardView, loadBoardView } from "@/components/app/board-view";
import { Drawers, loadDrawers } from "@/components/app/drawers";

async function load({ viewer, params, cookies }: PageContext) {
  // Filter: from the URL when it names any filter (links from other pages), else the text
  // last searched here. Only the text is ever saved, so no hidden filter comes back.
  const fromUrl = [...BOARD_FILTER_KEYS, "project"].some((k) => params[k] !== undefined);
  const filter = fromUrl ? parseBoardFilter(params) : { q: parseBoardFilter(decodeURIComponent(cookies[BOARD_FILTER_COOKIE] ?? "")).q };
  const columnFilters = parseColumnFilters(decodeURIComponent(cookies[COLUMN_FILTER_COOKIE] ?? ""));
  const siblings = params.task && viewer.personalBoardId ? getBoardTaskIds(viewer.personalBoardId, viewer.workspaceIds) : undefined;
  const [board, drawers] = await Promise.all([
    loadBoardView({ boardId: viewer.personalBoardId, viewer, params, basePath: "/platform/board", filter, columnFilters }),
    loadDrawers(params, viewer, siblings),
  ]);
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

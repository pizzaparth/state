"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Route } from "next";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import type { DueState } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar, DISPLAY, DueLabel, PriorityMark, TICK, WeightMark } from "./primitives";
import { moveTaskAction, type ActionResult } from "@/app/(app)/actions";
import type { MoveResult } from "@/lib/mutations";
import { useNotice } from "./notice";
import { BoardSortBar } from "./board-sort";
import { BOARD_SORT_COOKIE, BOARD_SORT_PARAM, formatBoardSort, parseBoardSort, sortCards, type SortKey } from "@/lib/board-sort";

export interface BoardCard {
  id: string;
  title: string;
  columnId: string;
  projectName: string | null;
  priority: string;
  weight: number;
  due: DueState | null;
  /** Epoch ms, for sorting */
  dueAt: number | null;
  /** Epoch ms, for sorting */
  createdAt: number;
  assigneeName: string | null;
  assigneeInitials: string | null;
  tags: string[];
}

export interface BoardColumn {
  id: string;
  name: string;
  stateType: string;
  total: number;
}

export type MoveTask = (input: { taskId: string; columnId: string; afterTaskId: string | null }) => Promise<ActionResult<MoveResult>>;

/**
 * Kanban with optimistic moves (drag, keyboard drag via space + arrows, or the per-card
 * "Move to" menu). The card moves at once; the server then checks access, places it and
 * records the commit for Done. A rejected move snaps the board back.
 *
 * `move` defaults to the real Server Action; the landing page's demo board passes a
 * local one. Without `taskHref`, card titles are plain text.
 *
 * With `initialSort`, a sort bar orders every column by those keys (kept in the URL and a
 * cookie). While sorted, a drag only changes the column; the card lands at the end of the
 * column's manual order, so switching back to manual keeps the old arrangement.
 */
export function Kanban({
  columns,
  cards: initial,
  taskHref,
  showAssignee,
  doneWindowDays,
  initialSort,
  move = moveTaskAction,
}: {
  columns: BoardColumn[];
  cards: BoardCard[];
  taskHref?: Record<string, string>;
  showAssignee: boolean;
  doneWindowDays: number;
  /** Shows the sort bar, starting from these keys (empty = manual). */
  initialSort?: SortKey[];
  move?: MoveTask;
}) {
  const [cards, setCards] = React.useState(initial);
  // Fresh server data (after a save or a refresh) replaces the optimistic copy
  React.useEffect(() => setCards(initial), [initial]);
  const [sort, setSort] = React.useState<SortKey[]>(initialSort ?? []);
  // Back/forward or a server render with another sort replaces the local one
  const initialValue = initialSort ? formatBoardSort(initialSort) : null;
  React.useEffect(() => {
    if (initialValue !== null) setSort(parseBoardSort(initialValue));
  }, [initialValue]);
  const sorted = sort.length > 0;
  const sortValue = formatBoardSort(sort);
  const changeSort = (next: SortKey[]) => {
    setSort(next);
    const value = formatBoardSort(next);
    // URL for deep links (no server round trip: the order is computed here), cookie so the
    // board opens the same way next time
    const url = new URL(window.location.href);
    if (next.length > 0) url.searchParams.set(BOARD_SORT_PARAM, value);
    else url.searchParams.delete(BOARD_SORT_PARAM);
    window.history.replaceState(window.history.state, "", url);
    document.cookie = `${BOARD_SORT_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
  };
  const shown = React.useMemo(() => sortCards(cards, sort), [cards, sort]);
  // Task links carry the live sort, so opening a task keeps the board as it is
  const hrefFor = (id: string) => {
    const href = taskHref?.[id];
    if (!href || !initialSort) return href;
    const url = new URL(href, "http://board.local");
    if (sorted) url.searchParams.set(BOARD_SORT_PARAM, sortValue);
    else url.searchParams.delete(BOARD_SORT_PARAM);
    return url.pathname + url.search;
  };
  const [dragging, setDragging] = React.useState<BoardCard | null>(null);
  const [overColumn, setOverColumn] = React.useState<string | null>(null);
  // Card that just reached Done: a brief flash acknowledges the recorded commit
  const [flashId, setFlashId] = React.useState<string | null>(null);
  const flashTimer = React.useRef<number | undefined>(undefined);
  const startColumn = React.useRef<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const notify = useNotice();

  const dndId = React.useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columnOf = (id: string) => (columns.some((c) => c.id === id) ? id : cards.find((c) => c.id === id)?.columnId);
  const doneId = columns.find((c) => c.stateType === "done")?.id;

  /** Persists a move already shown on screen; restores `before` if the server refuses it. */
  const persist = async (card: BoardCard, fromColumn: string | null, toColumn: string, next: BoardCard[], before: BoardCard[]) => {
    const inColumn = next.filter((c) => c.columnId === toColumn);
    const index = inColumn.findIndex((c) => c.id === card.id);
    const result = await move({ taskId: card.id, columnId: toColumn, afterTaskId: inColumn[index - 1]?.id ?? null });
    if (!result.ok) {
      setCards(before);
      notify(result.error);
      return;
    }
    const name = columns.find((c) => c.id === toColumn)?.name ?? "column";
    if (result.data.committed > 0) {
      window.clearTimeout(flashTimer.current);
      setFlashId(card.id);
      flashTimer.current = window.setTimeout(() => setFlashId(null), 950);
      notify(`“${card.title}” done. Commit recorded, +${result.data.committed}.${result.data.recurred ? " Next one queued." : ""}`);
    } else if (result.data.reopened) notify(`“${card.title}” reopened. Its commit was withdrawn.`);
    else if (toColumn !== fromColumn) notify(`“${card.title}” moved to ${name}.`);
  };

  const moveTo = (cardId: string, toColumn: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.columnId === toColumn) return;
    const next = [...cards.filter((c) => c.id !== cardId), { ...card, columnId: toColumn }];
    setCards(next);
    void persist(card, card.columnId, toColumn, next, cards);
  };

  const beforeDrag = React.useRef<BoardCard[]>(initial);

  const onDragStart = ({ active }: DragStartEvent) => {
    const card = cards.find((c) => c.id === active.id) ?? null;
    beforeDrag.current = cards;
    setDragging(card);
    startColumn.current = card?.columnId ?? null;
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return setOverColumn(null);
    const to = columnOf(String(over.id));
    setOverColumn(to ?? null);
    if (!to) return;
    setCards((prev) => {
      const card = prev.find((c) => c.id === active.id);
      if (!card || card.columnId === to) return prev;
      return prev.map((c) => (c.id === card.id ? { ...c, columnId: to } : c));
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    setOverColumn(null);
    const card = cards.find((c) => c.id === active.id);
    if (!over || !card) {
      setCards(beforeDrag.current);
      return;
    }
    let next = cards;
    if (!sorted && active.id !== over.id && cards.some((c) => c.id === over.id)) {
      next = arrayMove(cards, cards.findIndex((c) => c.id === active.id), cards.findIndex((c) => c.id === over.id));
      setCards(next);
    }
    const before = beforeDrag.current;
    if (sorted) {
      // Sorted view: only the column can change; append to that column's manual order
      if (startColumn.current === card.columnId) return setCards(before);
      next = [...cards.filter((c) => c.id !== card.id), card];
      setCards(next);
      void persist(card, startColumn.current, card.columnId, next, before);
      return;
    }
    // Nothing changed: same column, same neighbours
    const order = (list: BoardCard[]) => list.filter((c) => c.columnId === card.columnId).map((c) => c.id).join();
    if (startColumn.current === card.columnId && order(next) === order(before)) return;
    void persist(card, startColumn.current, card.columnId, next, before);
  };

  return (
    <DndContext
      // Stable id: dnd-kit's own counter differs between server and client and breaks hydration
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(null);
        setOverColumn(null);
        setCards(beforeDrag.current);
      }}
    >
      {initialSort && <BoardSortBar sort={sort} onChange={changeSort} />}
      <div
        className={cn("grid gap-5 overflow-x-auto pb-4 md:grid-flow-col md:auto-cols-[minmax(15rem,1fr)]", dragging && "select-none")}
      >
        {columns.map((column) => {
          const columnCards = shown.filter((c) => c.columnId === column.id);
          const isDone = column.id === doneId;
          return (
            <Column key={column.id} column={column} highlighted={overColumn === column.id && dragging?.columnId !== startColumn.current}>
              {/* Count and Σ weight: what the column holds, in execution */}
              <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
                <h2 className={cn(DISPLAY, "text-lg leading-none text-[#0A0A0A]")}>{column.name}</h2>
                <span
                  className="font-mono text-[13px] tabular-nums text-[#52525B]"
                  title={isDone ? `${columnCards.length} done in ${doneWindowDays} days, ${sumWeight(columnCards)} execution` : `${columnCards.length} tasks, ${sumWeight(columnCards)} execution queued`}
                >
                  {columnCards.length}
                  {isDone && <span className="text-[#71717A]">/{doneWindowDays}d</span>}
                  <span className="ml-2 font-semibold text-[#0A0A0A]">
                    {isDone ? "+" : "Σ"}
                    {sumWeight(columnCards)}
                  </span>
                </span>
              </div>
              <SortableContext items={columnCards.map((c) => c.id)} strategy={sorted ? noReorder : verticalListSortingStrategy}>
                <ul className="flex min-h-24 flex-col gap-3">
                  {columnCards.map((card) => (
                    <SortableCard
                      key={card.id}
                      card={card}
                      flash={flashId === card.id}
                      href={hrefFor(card.id)}
                      done={isDone}
                      showAssignee={showAssignee}
                      columns={columns}
                      onMove={(to) => moveTo(card.id, to)}
                    />
                  ))}
                  {columnCards.length === 0 && (
                    <li className="rounded-[14px] border border-dashed border-black/[0.06] px-3 py-6 text-center text-sm text-[#52525B]">
                      drop here
                    </li>
                  )}
                </ul>
              </SortableContext>
            </Column>
          );
        })}
      </div>
      {/* Portalled to <body>: a transformed ancestor (the page-enter animation) would otherwise
          become the containing block for the fixed overlay and offset it from the pointer */}
      {mounted &&
        createPortal(
          <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
            {dragging ? <CardFace card={dragging} done={false} showAssignee={showAssignee} lifted /> : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}

// Sorted columns do not make room under the pointer: the sort decides where a card lands
const noReorder = () => null;

const sumWeight = (cards: { weight: number }[]) => cards.reduce((sum, c) => sum + c.weight, 0);

function Column({ column, highlighted, children }: { column: BoardColumn; highlighted: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: column.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={column.name}
      className={cn(
        "rounded-[24px] p-3 transition-[box-shadow,background-color] duration-150",
        highlighted ? "app-field bg-white" : "app-panel"
      )}
    >
      {children}
    </section>
  );
}

function SortableCard({
  card,
  flash,
  href,
  done,
  showAssignee,
  columns,
  onMove,
}: {
  card: BoardCard;
  flash: boolean;
  href?: string;
  done: boolean;
  showAssignee: boolean;
  columns: BoardColumn[];
  onMove: (columnId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // The placeholder left behind while dragging is inert and dimmed
      inert={isDragging || undefined}
      className={cn("relative", isDragging && "opacity-40")}
    >
      <div {...attributes} {...listeners} aria-roledescription="draggable task" className="animate-row-in cursor-grab rounded-[16px] active:cursor-grabbing">
        <CardFace card={card} done={done} showAssignee={showAssignee} href={href} flash={flash} />
      </div>
      <Menu.Root>
        <Menu.Trigger
          aria-label={`Move “${card.title}” to another column`}
          className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-[#52525B] transition-colors hover:bg-black/[0.05] hover:text-[#0A0A0A] data-[state=open]:bg-black/[0.05]"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content align="end" sideOffset={6} className="app-card z-50 origin-[var(--radix-dropdown-menu-content-transform-origin)] data-[state=closed]:animate-menu-out data-[state=open]:animate-menu-in min-w-44 rounded-[16px] p-1.5 text-base">
            <Menu.Label className="px-3 pb-1 pt-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#52525B]">Move to…</Menu.Label>
            {columns
              .filter((c) => c.id !== card.columnId)
              .map((c) => (
                <Menu.Item
                  key={c.id}
                  onSelect={() => onMove(c.id)}
                  className="cursor-pointer rounded-[10px] px-3 py-2 text-[#0A0A0A] outline-none data-[highlighted]:bg-black/[0.05]"
                >
                  {c.name}
                </Menu.Item>
              ))}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </li>
  );
}

function CardFace({
  card,
  done,
  showAssignee,
  href,
  lifted = false,
  flash = false,
}: {
  card: BoardCard;
  done: boolean;
  showAssignee: boolean;
  href?: string;
  lifted?: boolean;
  flash?: boolean;
}) {
  const title = (
    <span className={cn("block pr-8 text-base font-medium leading-snug", done ? "text-[#52525B] line-through decoration-black/30" : "text-[#0A0A0A]")}>
      {card.title}
    </span>
  );
  return (
    <div
      className={cn(
        "relative rounded-[16px] p-3.5",
        lifted ? "app-card rotate-[1.5deg] scale-[1.04] cursor-grabbing border-accent bg-white" : "app-card"
      )}
    >
      {flash && <span aria-hidden="true" className="pointer-events-none absolute inset-0 animate-flash rounded-[16px] bg-accent/25" />}
      {href ? (
        <Link href={href as Route} scroll={false} className="rounded-[6px] focus-visible:outline-2">
          {title}
        </Link>
      ) : (
        title
      )}
      {card.projectName && <p className={cn(TICK, "mt-1.5 truncate text-[11px] text-[#71717A]")}>{card.projectName}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {card.due && !done && <DueLabel due={card.due} />}
        <PriorityMark priority={card.priority} />
        <span className="flex-1" />
        <WeightMark weight={card.weight} />
        {showAssignee && card.assigneeName && card.assigneeInitials && <Avatar name={card.assigneeName} initials={card.assigneeInitials} />}
      </div>
    </div>
  );
}

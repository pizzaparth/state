"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ArrowRight, Loader2, MoreHorizontal, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DISPLAY } from "./primitives";
import {
  addBoardTaskAction,
  addColumnAction,
  bulkRestoreTasksAction,
  bulkUpdateTasksAction,
  deleteColumnAction,
  deleteTaskAction,
  moveColumnAction,
  moveTaskAction,
  renameColumnAction,
  restoreTaskAction,
  setColumnLimitAction,
  setTaskDueAction,
  setTaskPriorityAction,
  setTaskWeightAction,
  type ActionResult,
} from "@/app/(app)/actions";
import type { MoveResult } from "@/lib/mutations";
import { PRIORITIES } from "@/lib/validation";
import { markPanelOpen } from "@/lib/panel-history";
import { useNotice } from "./notice";
import { BoardSortBar } from "./board-sort";
import { BoardFilterBar } from "./board-filter-bar";
import { PromptDialog } from "./prompt-dialog";
import { CardFace, SortableCard, menuContent, menuItem, type BoardCard, type BoardColumn, type CardCommand } from "./kanban-card";
import { BOARD_SORT_COOKIE, BOARD_SORT_PARAM, formatBoardSort, parseBoardSort, sortCards, type SortKey } from "@/lib/board-sort";
import { BOARD_FILTER_COOKIE, BOARD_FILTER_KEYS, filterCards, formatBoardFilter, isFiltered, parseBoardFilter, type BoardFilter } from "@/lib/board-filter";

export type { BoardCard, BoardColumn } from "./kanban-card";

export type MoveTask = (input: { taskId: string; columnId: string; afterTaskId: string | null }) => Promise<ActionResult<MoveResult>>;

/** Cards mounted per column before "Show 50 more". */
const PAGE = 50;

type Pending = { columnId: string; afterTaskId: string | null };

/** `list` with `id` moved into `columnId`, right after `afterId` (top of the column when null). */
function placeAfter(list: BoardCard[], id: string, columnId: string, afterId: string | null): BoardCard[] {
  const card = list.find((c) => c.id === id);
  if (!card) return list;
  const rest = list.filter((c) => c.id !== id);
  const moved = { ...card, columnId };
  if (afterId) {
    const i = rest.findIndex((c) => c.id === afterId);
    if (i >= 0) return [...rest.slice(0, i + 1), moved, ...rest.slice(i + 1)];
  }
  const i = rest.findIndex((c) => c.columnId === columnId);
  return i >= 0 ? [...rest.slice(0, i), moved, ...rest.slice(i)] : [...rest, moved];
}

const shiftDay = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const setCookie = (name: string, value: string) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
};

/**
 * Kanban with optimistic moves (drag, keyboard drag via space + arrows, the card menu,
 * right-click, or the complete circle). The card moves at once; the server then checks
 * access, places it and records the commit for Done. A rejected move snaps that card back.
 *
 * Moves still in flight are re-applied on top of every server refresh, so two quick
 * moves never flicker back and forth.
 *
 * Sort and filter are computed here (kept in the URL and cookies). While sorted, a drag
 * only changes the column; the card lands at the end of the column's manual order. Done
 * is always newest first.
 */
export function Kanban({
  columns,
  cards: initial,
  taskHref,
  doneWindowDays,
  initialSort,
  initialFilter,
  projects = [],
  tags = [],
  today,
  historyHref,
  move = moveTaskAction,
}: {
  columns: BoardColumn[];
  cards: BoardCard[];
  taskHref?: Record<string, string>;
  doneWindowDays: number;
  /** Shows the sort and filter bars, starting from these keys (empty = manual). */
  initialSort?: SortKey[];
  initialFilter?: BoardFilter;
  projects?: { id: string; name: string; slug: string }[];
  tags?: string[];
  /** YYYY-MM-DD in the viewer's zone. */
  today: string;
  /** Where Done cards older than the window are listed. */
  historyHref?: string;
  move?: MoveTask;
}) {
  const router = useRouter();
  const notify = useNotice();
  const pendingMoves = React.useRef(new Map<string, Pending>());
  const pendingAdds = React.useRef(new Map<string, BoardCard>());
  const latest = React.useRef(initial);
  const reconcile = React.useCallback((base: BoardCard[]) => {
    let list = base;
    for (const [id, m] of pendingMoves.current) list = placeAfter(list, id, m.columnId, m.afterTaskId);
    for (const card of pendingAdds.current.values()) if (!list.some((c) => c.id === card.id)) list = [card, ...list];
    return list;
  }, []);
  const [cards, setCards] = React.useState(initial);
  // Fresh server data replaces the optimistic copy, with in-flight changes laid on top
  React.useEffect(() => {
    latest.current = initial;
    setCards(reconcile(initial));
  }, [initial, reconcile]);

  // ------------------------------------------------------------ sort and filter
  const [sort, setSort] = React.useState<SortKey[]>(initialSort ?? []);
  const initialValue = initialSort ? formatBoardSort(initialSort) : null;
  React.useEffect(() => {
    if (initialValue !== null) setSort(parseBoardSort(initialValue));
  }, [initialValue]);
  const [filter, setFilter] = React.useState<BoardFilter>(initialFilter ?? {});
  const initialFilterValue = initialFilter ? formatBoardFilter(initialFilter) : null;
  React.useEffect(() => {
    if (initialFilterValue !== null) setFilter(parseBoardFilter(initialFilterValue));
  }, [initialFilterValue]);
  const sorted = sort.length > 0;
  const sortValue = formatBoardSort(sort);
  const replaceUrl = (edit: (url: URL) => void) => {
    const url = new URL(window.location.href);
    edit(url);
    window.history.replaceState(window.history.state, "", url);
  };
  const changeSort = (next: SortKey[]) => {
    setSort(next);
    const value = formatBoardSort(next);
    replaceUrl((url) => (next.length > 0 ? url.searchParams.set(BOARD_SORT_PARAM, value) : url.searchParams.delete(BOARD_SORT_PARAM)));
    setCookie(BOARD_SORT_COOKIE, value);
  };
  const changeFilter = (next: BoardFilter) => {
    setFilter(next);
    replaceUrl((url) => {
      for (const key of BOARD_FILTER_KEYS) {
        const value = next[key];
        if (value) url.searchParams.set(key, value);
        else url.searchParams.delete(key);
      }
    });
    setCookie(BOARD_FILTER_COOKIE, formatBoardFilter(next));
  };
  const filtered = React.useMemo(() => filterCards(cards, filter, today), [cards, filter, today]);
  const shown = React.useMemo(() => sortCards(filtered, sort), [filtered, sort]);
  const filterOn = isFiltered(filter);
  const doneId = columns.find((c) => c.stateType === "done")?.id;
  const columnCards = (columnId: string) => {
    const list = shown.filter((c) => c.columnId === columnId);
    if (columnId === doneId) return [...list].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    // Deferred cards wait at the bottom until their day
    return [...list.filter((c) => !c.deferred), ...list.filter((c) => c.deferred)];
  };

  // Task links carry the live sort and filter, so opening a task keeps the board as it is
  const hrefFor = (id: string) => {
    const href = taskHref?.[id];
    if (!href || !initialSort) return href;
    const url = new URL(href, "http://board.local");
    if (sorted) url.searchParams.set(BOARD_SORT_PARAM, sortValue);
    else url.searchParams.delete(BOARD_SORT_PARAM);
    for (const key of BOARD_FILTER_KEYS) {
      const value = filter[key];
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    return url.pathname + url.search;
  };
  const openCard = (id: string) => {
    const href = hrefFor(id);
    if (!href) return;
    markPanelOpen(href);
    router.push(href as Route, { scroll: false });
  };

  // ------------------------------------------------------------ drag state
  const [dragging, setDragging] = React.useState<BoardCard | null>(null);
  const [overColumn, setOverColumn] = React.useState<string | null>(null);
  const [flashId, setFlashId] = React.useState<string | null>(null);
  const flashTimer = React.useRef<number | undefined>(undefined);
  const startColumn = React.useRef<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const dndId = React.useId();
  const sensors = useSensors(
    // Mouse drags after 6 px. Touch drags after a 180 ms press, so a quick swipe still
    // scrolls the page or the column strip
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columnOf = (id: string) => (columns.some((c) => c.id === id) ? id : cards.find((c) => c.id === id)?.columnId);
  const columnName = (id: string | undefined) => columns.find((c) => c.id === id)?.name ?? "column";

  /** Persists a move already shown on screen; puts that card back if the server refuses it. */
  const persist = async (card: BoardCard, fromColumn: string | null, toColumn: string, next: BoardCard[]) => {
    const inColumn = next.filter((c) => c.columnId === toColumn);
    const index = inColumn.findIndex((c) => c.id === card.id);
    const afterTaskId = inColumn[index - 1]?.id ?? null;
    pendingMoves.current.set(card.id, { columnId: toColumn, afterTaskId });
    const result = await move({ taskId: card.id, columnId: toColumn, afterTaskId });
    pendingMoves.current.delete(card.id);
    if (!result.ok) {
      setCards(reconcile(latest.current));
      notify(result.error);
      return;
    }
    if (result.data.committed > 0) {
      window.clearTimeout(flashTimer.current);
      setFlashId(card.id);
      flashTimer.current = window.setTimeout(() => setFlashId(null), 950);
      const back = fromColumn;
      notify(`Done. +${result.data.committed}.${result.data.recurred ? " Next one queued." : ""}`, back
        ? { label: "Undo", run: () => moveTo(card.id, back) }
        : undefined);
    } else if (result.data.reopened) notify(`“${card.title}” reopened. Its commit was withdrawn.`);
    else if (toColumn !== fromColumn) notify(`“${card.title}” moved to ${columnName(toColumn)}.`);
  };

  const withDone = (card: BoardCard, toColumn: string): BoardCard => ({
    ...card,
    columnId: toColumn,
    completedAt: toColumn === doneId ? (card.completedAt ?? Date.now()) : null,
  });

  const cardsRef = React.useRef(cards);
  cardsRef.current = cards;
  const moveTo = (cardId: string, toColumn: string) => {
    const prev = cardsRef.current;
    const card = prev.find((c) => c.id === cardId);
    if (!card || card.columnId === toColumn) return;
    // Top of the target column
    const next = placeAfter(prev.map((c) => (c.id === cardId ? withDone(c, toColumn) : c)), cardId, toColumn, null);
    cardsRef.current = next;
    setCards(next);
    void persist(card, card.columnId, toColumn, next);
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
      return prev.map((c) => (c.id === card.id ? withDone(c, to) : c));
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
    const inDone = card.columnId === doneId;
    let next = cards;
    if (!sorted && !inDone && active.id !== over.id && cards.some((c) => c.id === over.id)) {
      next = arrayMove(cards, cards.findIndex((c) => c.id === active.id), cards.findIndex((c) => c.id === over.id));
      setCards(next);
    }
    if (sorted || inDone) {
      // Sorted view or Done: only the column can change
      if (startColumn.current === card.columnId) return setCards(beforeDrag.current);
      next = inDone ? placeAfter(cards, card.id, card.columnId, null) : [...cards.filter((c) => c.id !== card.id), card];
      setCards(next);
      void persist(card, startColumn.current, card.columnId, next);
      return;
    }
    const order = (list: BoardCard[]) => list.filter((c) => c.columnId === card.columnId).map((c) => c.id).join();
    if (startColumn.current === card.columnId && order(next) === order(beforeDrag.current)) return;
    void persist(card, startColumn.current, card.columnId, next);
  };

  // Screen reader announcements in plain words (dnd-kit's live region)
  const position = (cardId: string, columnId: string | undefined) => {
    const list = columnId ? columnCards(columnId) : [];
    const i = list.findIndex((c) => c.id === cardId);
    return `${columnName(columnId)}, position ${i < 0 ? list.length + 1 : i + 1} of ${Math.max(list.length, i + 1)}`;
  };
  const titleOf = (id: string | number) => cards.find((c) => c.id === id)?.title ?? "task";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}. ${position(String(active.id), columnOf(String(active.id)))}.`,
    onDragOver: ({ active, over }) => (over ? `Over ${position(String(active.id), columnOf(String(over.id)))}.` : `${titleOf(active.id)} is not over a column.`),
    onDragEnd: ({ active, over }) => (over ? `Dropped ${titleOf(active.id)} in ${position(String(active.id), columnOf(String(over.id)))}.` : `${titleOf(active.id)} dropped back where it was.`),
    onDragCancel: ({ active }) => `Cancelled. ${titleOf(active.id)} is back where it was.`,
  };
  const screenReaderInstructions = {
    draggable: "Press Space to pick up a task. Use the arrow keys to move it within and between columns, Space to drop, Escape to cancel. Enter opens it, X selects it.",
  };

  // ------------------------------------------------------------ card commands
  const updateCard = (id: string, patch: Partial<BoardCard>) => setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const runCommand = (card: BoardCard, command: CardCommand) => {
    if (command.type === "open") return openCard(card.id);
    if (command.type === "move") return moveTo(card.id, command.columnId);
    if (command.type === "complete") {
      if (doneId) moveTo(card.id, doneId);
      return;
    }
    void (async () => {
      if (command.type === "priority") {
        const before = card.priority;
        updateCard(card.id, { priority: command.priority });
        const r = await setTaskPriorityAction({ taskId: card.id, priority: command.priority });
        if (!r.ok) {
          updateCard(card.id, { priority: before });
          notify(r.error);
        }
      } else if (command.type === "weight") {
        const before = card.weight;
        updateCard(card.id, { weight: command.weight });
        const r = await setTaskWeightAction({ taskId: card.id, weight: command.weight });
        if (!r.ok) {
          updateCard(card.id, { weight: before });
          notify(r.error);
        }
      } else if (command.type === "due") {
        const nextMonday = shiftDay(today, ((8 - new Date(`${today}T00:00:00Z`).getUTCDay()) % 7) || 7);
        const dueDate = command.when === "clear" ? null : command.when === "today" ? today : command.when === "tomorrow" ? shiftDay(today, 1) : nextMonday;
        const r = await setTaskDueAction({ taskId: card.id, dueDate });
        notify(r.ok ? (dueDate ? `Due ${command.when === "next-week" ? "next week" : command.when}.` : "Due date cleared.") : r.error);
      } else if (command.type === "delete") {
        setCards((prev) => prev.filter((c) => c.id !== card.id));
        const r = await deleteTaskAction({ taskId: card.id });
        if (!r.ok) {
          setCards(reconcile(latest.current));
          notify(r.error);
          return;
        }
        notify(`Deleted “${card.title}”.`, {
          label: "Undo",
          run: async () => {
            const restored = await restoreTaskAction({ taskId: card.id });
            notify(restored.ok ? `Restored “${restored.data.title}”.` : restored.error);
          },
        });
      }
    })();
  };

  // ------------------------------------------------------------ add a task (C1)
  const [adding, setAdding] = React.useState<string | null>(null);
  const addInputs = React.useRef(new Map<string, HTMLInputElement>());
  const firstOpenColumn = columns.find((c) => c.stateType !== "done");
  const add = async (columnId: string, text: string): Promise<string | null> => {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const temp: BoardCard = {
      id: tempId,
      title: text,
      columnId,
      projectName: null,
      projectSlug: null,
      priority: "none",
      weight: 2,
      due: null,
      dueAt: null,
      dueDay: null,
      createdAt: Date.now(),
      completedAt: null,
      tags: [],
      recurring: false,
      hasNote: false,
      checklist: null,
      daysInColumn: 0,
      deferred: false,
      deferLabel: null,
      pending: true,
    };
    pendingAdds.current.set(tempId, temp);
    setCards((prev) => placeAfter([temp, ...prev], tempId, columnId, null));
    const result = await addBoardTaskAction({ title: text, columnId });
    pendingAdds.current.delete(tempId);
    if (!result.ok) {
      setCards((prev) => prev.filter((c) => c.id !== tempId));
      return result.error;
    }
    // The refresh that follows the save brings the saved card; until then keep the temp one, renamed
    setCards((prev) =>
      prev.some((c) => c.id === result.data.id)
        ? prev.filter((c) => c.id !== tempId)
        : prev.map((c) => (c.id === tempId ? { ...c, id: result.data.id, title: result.data.title, projectName: result.data.projectName, priority: result.data.priority, weight: result.data.weight } : c))
    );
    return null;
  };

  // ------------------------------------------------------------ selection (C9)
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Selections of cards that left the board drop out
  React.useEffect(() => {
    setSelected((prev) => {
      const live = new Set(cards.map((c) => c.id));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [cards]);

  // ------------------------------------------------------------ paging and phone layout
  const [visible, setVisible] = React.useState<Record<string, number>>({});
  const [phoneColumn, setPhoneColumn] = React.useState(firstOpenColumn?.id ?? columns[0]?.id);

  // ------------------------------------------------------------ board keys: A add, F filter, Esc clear selection
  const filterRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape" && selected.size > 0 && !target.closest("input, textarea, select, [role=dialog], [role=menu]")) {
        setSelected(new Set());
        return;
      }
      if (target.closest("input, textarea, select, [contenteditable=true], [role=dialog], [role=menu]")) return;
      const key = e.key.toLowerCase();
      if (key === "a" && firstOpenColumn) {
        e.preventDefault();
        setPhoneColumn(firstOpenColumn.id);
        setAdding(firstOpenColumn.id);
        window.setTimeout(() => addInputs.current.get(firstOpenColumn.id)?.focus(), 0);
      } else if (key === "f" && initialSort) {
        e.preventDefault();
        filterRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size, firstOpenColumn, initialSort]);

  return (
    <DndContext
      // Stable id: dnd-kit's own counter differs between server and client and breaks hydration
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements, screenReaderInstructions }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(null);
        setOverColumn(null);
        setCards(beforeDrag.current);
      }}
    >
      {initialSort && (
        <div className="md:flex md:flex-wrap md:items-start md:gap-x-3 [&>*]:md:flex-1">
          <BoardSortBar sort={sort} onChange={changeSort} />
          <BoardFilterBar filter={filter} onChange={changeFilter} projects={projects} tags={tags} textRef={filterRef} />
        </div>
      )}

      {/* Phones: one column at a time */}
      <div role="tablist" aria-label="Column" className="app-field mb-4 flex gap-1 overflow-x-auto rounded-full p-1 md:hidden">
        {columns.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={phoneColumn === c.id}
            onClick={() => setPhoneColumn(c.id)}
            className={cn(
              "mi-press h-11 shrink-0 flex-1 whitespace-nowrap rounded-full px-4 text-[15px] font-medium",
              phoneColumn === c.id ? "bg-[#0A0A0A] text-white" : "text-[#52525B]"
            )}
          >
            {c.name} <span className="font-mono text-[13px] tabular-nums opacity-70">{columnCards(c.id).length}</span>
          </button>
        ))}
      </div>

      <div className={cn("grid gap-5 overflow-x-auto pb-4 md:grid-flow-col md:auto-cols-[minmax(15rem,1fr)]", dragging && "select-none")}>
        {columns.map((column, ci) => {
          const list = columnCards(column.id);
          const isDone = column.id === doneId;
          const total = cards.filter((c) => c.columnId === column.id).length;
          const limit = visible[column.id] ?? PAGE;
          const over = column.wipLimit !== null && total > column.wipLimit;
          return (
            <Column
              key={column.id}
              column={column}
              highlighted={overColumn === column.id && dragging?.columnId !== startColumn.current}
              phoneHidden={phoneColumn !== column.id}
            >
              {/* Count and Σ weight: what the column holds, in execution */}
              <div className="mb-3 flex items-center justify-between gap-2 px-1">
                <h2 className={cn(DISPLAY, "min-w-0 truncate text-lg leading-none text-[#0A0A0A]")}>{column.name}</h2>
                <span className="flex shrink-0 items-center gap-1">
                  <span
                    className="font-mono text-[13px] tabular-nums text-[#52525B]"
                    title={
                      isDone
                        ? `${list.length} done in ${doneWindowDays} days, ${sumWeight(list)} execution`
                        : `${list.length} tasks, ${sumWeight(list)} execution queued${column.wipLimit ? `; limit ${column.wipLimit}` : ""}`
                    }
                  >
                    {column.wipLimit ? (
                      <span className={cn(over && "font-semibold text-[#0A0A0A]")}>
                        {over && <span aria-hidden="true">▲</span>}
                        {total}/{column.wipLimit}
                        {over && <span className="sr-only"> over the limit</span>}
                      </span>
                    ) : (
                      list.length
                    )}
                    {isDone && <span className="text-[#71717A]">/{doneWindowDays}d</span>}
                    <span className="ml-2 font-semibold text-[#0A0A0A]">
                      {isDone ? "+" : "Σ"}
                      {sumWeight(list)}
                    </span>
                    {filterOn && <span className="ml-1.5 text-[11px] uppercase text-[#71717A]">filtered</span>}
                  </span>
                  {!isDone && (
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(column.id);
                        window.setTimeout(() => addInputs.current.get(column.id)?.focus(), 0);
                      }}
                      aria-label={`Add a task to ${column.name}`}
                      title={ci === 0 ? "Add task (A)" : "Add task"}
                      className="mi-press grid size-8 place-items-center rounded-full text-[#52525B] hover:bg-black/[0.05] hover:text-[#0A0A0A] [@media(pointer:coarse)]:size-11"
                    >
                      <Plus aria-hidden="true" className="size-4" />
                    </button>
                  )}
                  <ColumnMenu column={column} index={ci} columns={columns} empty={total === 0} notify={notify} />
                </span>
              </div>
              {adding === column.id && (
                <AddCard
                  columnName={column.name}
                  inputRef={(el) => {
                    if (el) addInputs.current.set(column.id, el);
                    else addInputs.current.delete(column.id);
                  }}
                  onAdd={(text) => add(column.id, text)}
                  onClose={() => setAdding(null)}
                />
              )}
              <SortableContext items={list.map((c) => c.id)} strategy={sorted || isDone ? noReorder : verticalListSortingStrategy}>
                <ul className="flex min-h-24 flex-col gap-3">
                  {list.slice(0, limit).map((card) => (
                    <SortableCard
                      key={card.id}
                      card={card}
                      flash={flashId === card.id}
                      href={hrefFor(card.id)}
                      done={isDone}
                      columns={columns}
                      selected={selected.has(card.id)}
                      selecting={selected.size > 0}
                      onCommand={(c) => runCommand(card, c)}
                      onToggleSelect={() => toggleSelect(card.id)}
                      onOpen={() => openCard(card.id)}
                    />
                  ))}
                  {list.length === 0 && (
                    <li className="rounded-[14px] border border-dashed border-black/[0.06] px-3 py-6 text-center text-sm text-[#52525B]">
                      {filterOn && total > 0 ? "none match" : "drop here"}
                    </li>
                  )}
                </ul>
              </SortableContext>
              {list.length > limit && (
                <button
                  type="button"
                  onClick={() => setVisible((v) => ({ ...v, [column.id]: limit + PAGE }))}
                  className="app-btn mi-press mt-3 h-10 w-full rounded-[12px] text-sm font-medium"
                >
                  Show {Math.min(PAGE, list.length - limit)} more <span className="font-mono text-[#71717A]">· {list.length - limit} hidden</span>
                </button>
              )}
              {isDone && historyHref && (
                <Link href={historyHref as Route} className="mi-arrow mt-3 flex items-center justify-between rounded-[12px] px-2 py-2 text-sm font-medium text-[#52525B] hover:text-[#0A0A0A]">
                  Older in History
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              )}
            </Column>
          );
        })}
      </div>

      {selected.size > 0 && (
        <BulkBar
          ids={[...selected]}
          columns={columns}
          projects={projects}
          onDone={() => setSelected(new Set())}
          onClear={() => setSelected(new Set())}
          notify={notify}
        />
      )}

      {/* Portalled to <body>: a transformed ancestor (the page-enter animation) would otherwise
          become the containing block for the fixed overlay and offset it from the pointer */}
      {mounted &&
        createPortal(
          <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
            {dragging ? <CardFace card={dragging} done={false} lifted /> : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}

// Sorted columns and Done do not make room under the pointer: the order decides where a card lands
const noReorder = () => null;

const sumWeight = (cards: { weight: number }[]) => cards.reduce((sum, c) => sum + c.weight, 0);

function Column({ column, highlighted, phoneHidden, children }: { column: BoardColumn; highlighted: boolean; phoneHidden: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: column.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={column.name}
      className={cn(
        "rounded-[24px] p-3 transition-[background-color] duration-150",
        highlighted ? "app-field bg-white" : "app-panel",
        phoneHidden && "max-md:hidden"
      )}
    >
      {children}
    </section>
  );
}

/** Inline field at the top of a column. Enter adds and keeps it open; Escape closes. */
function AddCard({
  columnName,
  inputRef,
  onAdd,
  onClose,
}: {
  columnName: string;
  inputRef: (el: HTMLInputElement | null) => void;
  onAdd: (text: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const id = React.useId();
  return (
    <form
      className="mb-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const text = value.trim();
        if (!text) {
          setError("Type a task first.");
          return;
        }
        setValue("");
        setError(null);
        setBusy(true);
        const message = await onAdd(text);
        setBusy(false);
        if (message) {
          setValue(text);
          setError(message);
        }
      }}
    >
      <label htmlFor={id} className="sr-only">
        Add a task to {columnName}
      </label>
      <div className="app-field flex items-center gap-1 rounded-[14px] p-1 pl-3">
        <input
          ref={inputRef}
          id={id}
          name="task"
          value={value}
          onChange={(e) => (setValue(e.target.value), setError(null))}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          onBlur={(e) => {
            if (!value.trim() && !e.currentTarget.form?.contains(e.relatedTarget as Node)) onClose();
          }}
          maxLength={500}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          placeholder="Add a task… #project !high fri"
          className="h-9 min-w-0 flex-1 bg-transparent text-base text-[#0A0A0A] placeholder:text-[#71717A] focus:outline-none"
        />
        {busy && <Loader2 aria-label="Saving…" className="size-4 animate-spin text-[#71717A]" />}
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-[10px] text-[#52525B] hover:bg-black/[0.05]">
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} aria-live="polite" className="mt-1.5 px-1 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

/** Column header menu: Rename…, Limit…, Add column right, Move, Delete (empty only). */
function ColumnMenu({
  column,
  index,
  columns,
  empty,
  notify,
}: {
  column: BoardColumn;
  index: number;
  columns: BoardColumn[];
  empty: boolean;
  notify: ReturnType<typeof useNotice>;
}) {
  const [dialog, setDialog] = React.useState<"rename" | "limit" | "add" | null>(null);
  const done = column.stateType === "done";
  const result = (r: ActionResult<unknown>, ok: string) => {
    notify(r.ok ? ok : r.error);
  };
  const neighbourDone = (i: number) => columns[i]?.stateType === "done";
  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          aria-label={`${column.name} column options`}
          className="mi-press grid size-8 place-items-center rounded-full text-[#52525B] hover:bg-black/[0.05] hover:text-[#0A0A0A] data-[state=open]:bg-black/[0.05] [@media(pointer:coarse)]:size-11"
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content align="end" sideOffset={6} className={menuContent}>
            <Menu.Item onSelect={() => setDialog("rename")} className={menuItem}>
              Rename…
            </Menu.Item>
            {!done && (
              <Menu.Item onSelect={() => setDialog("limit")} className={menuItem}>
                Limit…
              </Menu.Item>
            )}
            {!done && (
              <Menu.Item onSelect={() => setDialog("add")} className={menuItem}>
                Add column right…
              </Menu.Item>
            )}
            {!done && (
              <>
                <Menu.Item disabled={index === 0} onSelect={async () => result(await moveColumnAction({ columnId: column.id, direction: "left" }), `Moved ${column.name} left.`)} className={menuItem}>
                  Move left
                </Menu.Item>
                <Menu.Item disabled={neighbourDone(index + 1) || index === columns.length - 1} onSelect={async () => result(await moveColumnAction({ columnId: column.id, direction: "right" }), `Moved ${column.name} right.`)} className={menuItem}>
                  Move right
                </Menu.Item>
                <Menu.Separator className="my-1 h-px bg-black/[0.06]" />
                <Menu.Item disabled={!empty} onSelect={async () => result(await deleteColumnAction({ columnId: column.id }), `Deleted ${column.name}.`)} className={cn(menuItem, "text-danger")}>
                  Delete{empty ? "" : " (empty only)"}
                </Menu.Item>
              </>
            )}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
      <PromptDialog
        open={dialog === "rename"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Rename column"
        label="Name"
        initial={column.name}
        onSubmit={async (name) => {
          const r = await renameColumnAction({ columnId: column.id, name });
          if (r.ok) notify(`Renamed to ${name}.`);
          return r.ok ? null : r.error;
        }}
      />
      <PromptDialog
        open={dialog === "limit"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Limit for ${column.name}`}
        label="Most tasks at once"
        initial={column.wipLimit ? String(column.wipLimit) : ""}
        inputMode="numeric"
        placeholder="3…"
        hint="empty = no limit · warns, never blocks"
        onSubmit={async (value) => {
          const limit = value === "" ? null : Number(value);
          if (limit !== null && !Number.isInteger(limit)) return "Enter a whole number.";
          const r = await setColumnLimitAction({ columnId: column.id, limit });
          if (r.ok) notify(limit ? `Limit ${limit} on ${column.name}.` : `No limit on ${column.name}.`);
          return r.ok ? null : r.error;
        }}
      />
      <PromptDialog
        open={dialog === "add"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="New column"
        label="Name"
        initial=""
        placeholder="Review…"
        hint="counts as in progress: moving here starts a task"
        submitLabel="Add"
        onSubmit={async (name) => {
          const r = await addColumnAction({ afterColumnId: column.id, name, stateType: /review/i.test(name) ? "review" : "active" });
          if (r.ok) notify(`Added ${name}.`);
          return r.ok ? null : r.error;
        }}
      />
    </>
  );
}

const PRIORITY_LABEL: Record<string, string> = { none: "None", low: "Low", medium: "Medium", high: "High", critical: "Critical" };

/**
 * Bottom bar for a selection: Move, Priority, Project, Delete. One request, one
 * transaction, whatever the count (up to 100).
 */
export function BulkBar({
  ids,
  columns,
  projects,
  onDone,
  onClear,
  notify,
  moveLabel = "Move to…",
}: {
  ids: string[];
  columns: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  onDone: () => void;
  onClear: () => void;
  notify: ReturnType<typeof useNotice>;
  moveLabel?: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const apply = (change: { type: string } & Record<string, unknown>, label: string) =>
    startTransition(async () => {
      const r = await bulkUpdateTasksAction({ taskIds: ids, change });
      if (!r.ok) return notify(r.error);
      onDone();
      const extra = r.data.committed > 0 ? ` +${r.data.committed}.` : "";
      if (change.type === "delete") {
        notify(`Deleted ${r.data.changed}.`, {
          label: "Undo",
          run: async () => {
            const back = await bulkRestoreTasksAction({ taskIds: ids });
            notify(back.ok ? `Restored ${back.data.restored}.` : back.error);
          },
        });
      } else notify(`${label} ${r.data.changed}.${extra}${r.data.skipped ? ` ${r.data.skipped} skipped.` : ""}`);
    });
  const select = "app-select h-10 w-auto min-w-0 max-w-[10rem] rounded-full pl-3 text-[15px]";
  return (
    <div
      role="toolbar"
      aria-label={`${ids.length} selected`}
      className="app-overlay fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-[20px] p-2 lg:left-[17rem]"
    >
      <span className="px-2 font-mono text-sm font-semibold tabular-nums">{ids.length} selected</span>
      <select aria-label="Move selected" disabled={pending} value="" onChange={(e) => e.target.value && apply({ type: "move", columnId: e.target.value }, "Moved")} className={select}>
        <option value="">{moveLabel}</option>
        {columns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select aria-label="Priority of selected" disabled={pending} value="" onChange={(e) => e.target.value && apply({ type: "priority", priority: e.target.value }, "Priority set on")} className={select}>
        <option value="">Priority…</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </select>
      <select
        aria-label="Project of selected"
        disabled={pending}
        value=""
        onChange={(e) => e.target.value && apply({ type: "project", projectId: e.target.value === "none" ? null : e.target.value }, "Filed")}
        className={select}
      >
        <option value="">Project…</option>
        <option value="none">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="button" disabled={pending} onClick={() => apply({ type: "delete" }, "Deleted")} className="app-btn mi-press h-10 rounded-full px-4 text-[15px] font-medium text-danger disabled:opacity-60">
        Delete
      </button>
      <span className="flex-1" />
      {pending && <Loader2 aria-label="Saving…" className="size-4 animate-spin text-[#71717A]" />}
      <button type="button" onClick={onClear} className="mi-press inline-flex h-10 items-center gap-1 rounded-full px-3 text-[15px] text-[#52525B] hover:bg-black/[0.05]">
        <X aria-hidden="true" className="size-4" />
        Clear <kbd className="ml-1 hidden font-mono text-[12px] text-[#71717A] [@media(pointer:fine)]:inline">Esc</kbd>
      </button>
    </div>
  );
}

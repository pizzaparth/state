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
import { Avatar, DueLabel, PriorityMark, WeightMark } from "./primitives";
import { useLocalOnlyNotice } from "./notice";

export interface BoardCard {
  id: string;
  title: string;
  columnId: string;
  projectName: string | null;
  priority: string;
  weight: number;
  due: DueState | null;
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

/**
 * Kanban with optimistic local moves (drag, keyboard drag via space + arrows, or the
 * per-card "Move to" menu). Columns are Level 1 trays, cards Level 2 raised controls,
 * the hovered drop target turns inset.
 */
export function Kanban({
  columns,
  cards: initial,
  taskHref,
  showAssignee,
  doneWindowDays,
}: {
  columns: BoardColumn[];
  cards: BoardCard[];
  taskHref: Record<string, string>;
  showAssignee: boolean;
  doneWindowDays: number;
}) {
  const [cards, setCards] = React.useState(initial);
  const [dragging, setDragging] = React.useState<BoardCard | null>(null);
  const [overColumn, setOverColumn] = React.useState<string | null>(null);
  // Card that just reached Done: a brief flash acknowledges the recorded commit
  const [flashId, setFlashId] = React.useState<string | null>(null);
  const flashTimer = React.useRef<number | undefined>(undefined);
  const startColumn = React.useRef<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const notify = useLocalOnlyNotice();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columnOf = (id: string) => (columns.some((c) => c.id === id) ? id : cards.find((c) => c.id === id)?.columnId);
  const doneId = columns.find((c) => c.stateType === "done")?.id;

  const announceMove = (card: BoardCard, toColumn: string) => {
    const name = columns.find((c) => c.id === toColumn)?.name ?? "column";
    if (toColumn === doneId) {
      window.clearTimeout(flashTimer.current);
      setFlashId(card.id);
      flashTimer.current = window.setTimeout(() => setFlashId(null), 950);
      notify(`“${card.title}” moved to Done. A commit of +${card.weight} would be recorded.`);
    }
    else notify(`“${card.title}” moved to ${name}.`);
  };

  const moveTo = (cardId: string, toColumn: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.columnId === toColumn) return;
    setCards((prev) => [...prev.filter((c) => c.id !== cardId), { ...card, columnId: toColumn }]);
    announceMove(card, toColumn);
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    const card = cards.find((c) => c.id === active.id) ?? null;
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
    if (!over) return;
    const card = cards.find((c) => c.id === active.id);
    if (!card) return;
    if (active.id !== over.id && cards.some((c) => c.id === over.id)) {
      setCards((prev) => {
        const from = prev.findIndex((c) => c.id === active.id);
        const to = prev.findIndex((c) => c.id === over.id);
        return arrayMove(prev, from, to);
      });
    }
    if (startColumn.current && startColumn.current !== card.columnId) announceMove(card, card.columnId);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(null);
        setOverColumn(null);
        setCards(initial);
      }}
    >
      <div
        className={cn("grid gap-5 overflow-x-auto pb-4 md:grid-flow-col md:auto-cols-[minmax(15rem,1fr)]", dragging && "select-none")}
      >
        {columns.map((column) => {
          const columnCards = cards.filter((c) => c.columnId === column.id);
          const isDone = column.id === doneId;
          return (
            <Column key={column.id} column={column} highlighted={overColumn === column.id && dragging?.columnId !== startColumn.current}>
              <div className="mb-3 flex items-baseline justify-between px-1">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A9A96]">{column.name}</h2>
                <span className="font-mono text-[11px] tabular-nums text-[#9A9A96]">
                  {isDone ? `${columnCards.length} in ${doneWindowDays}d` : columnCards.length}
                </span>
              </div>
              <SortableContext items={columnCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <ul className="flex min-h-24 flex-col gap-3">
                  {columnCards.map((card) => (
                    <SortableCard
                      key={card.id}
                      card={card}
                      flash={flashId === card.id}
                      href={taskHref[card.id]}
                      done={isDone}
                      showAssignee={showAssignee}
                      columns={columns}
                      onMove={(to) => moveTo(card.id, to)}
                    />
                  ))}
                  {columnCards.length === 0 && (
                    <li className="rounded-[14px] border border-dashed border-white/10 px-3 py-6 text-center text-xs text-[#9A9A96]">
                      Drop a task here
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

function Column({ column, highlighted, children }: { column: BoardColumn; highlighted: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: column.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={column.name}
      className={cn(
        "rounded-[24px] p-3 transition-[box-shadow,background-color] duration-150",
        highlighted ? "app-field bg-[#000000]" : "app-panel"
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
  href: string;
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
      <div {...attributes} {...listeners} aria-roledescription="draggable task" className="cursor-grab rounded-[16px] active:cursor-grabbing">
        <CardFace card={card} done={done} showAssignee={showAssignee} href={href} flash={flash} />
      </div>
      <Menu.Root>
        <Menu.Trigger
          aria-label={`Move “${card.title}” to another column`}
          className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-[#9A9A96] transition-colors hover:bg-white/[0.06] hover:text-[#F2F2EF] data-[state=open]:bg-white/[0.06]"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content align="end" sideOffset={6} className="app-card z-50 origin-[var(--radix-dropdown-menu-content-transform-origin)] data-[state=closed]:animate-menu-out data-[state=open]:animate-menu-in min-w-44 rounded-[16px] p-1.5 text-sm">
            <Menu.Label className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A9A96]">Move to…</Menu.Label>
            {columns
              .filter((c) => c.id !== card.columnId)
              .map((c) => (
                <Menu.Item
                  key={c.id}
                  onSelect={() => onMove(c.id)}
                  className="cursor-pointer rounded-[10px] px-3 py-2 text-[#F2F2EF] outline-none data-[highlighted]:bg-white/[0.06]"
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
    <span className={cn("block pr-8 text-sm font-medium leading-snug", done ? "text-[#9A9A96] line-through decoration-white/30" : "text-[#F2F2EF]")}>
      {card.title}
    </span>
  );
  return (
    <div
      className={cn(
        "relative rounded-[16px] p-3.5",
        lifted ? "app-card scale-[1.02] cursor-grabbing border-white/40 bg-[#1A1A1A]" : "app-card"
      )}
    >
      {flash && <span aria-hidden="true" className="pointer-events-none absolute inset-0 animate-flash rounded-[16px] bg-white/[0.14]" />}
      {href ? (
        <Link href={href as Route} scroll={false} className="rounded-[6px] focus-visible:outline-2">
          {title}
        </Link>
      ) : (
        title
      )}
      {card.projectName && <p className="mt-1 truncate text-xs text-[#85857F]">{card.projectName}</p>}
      <div className="mt-3 flex items-center gap-3">
        {card.due && !done && <DueLabel due={card.due} />}
        <PriorityMark priority={card.priority} />
        <span className="flex-1" />
        <WeightMark weight={card.weight} />
        {showAssignee && card.assigneeName && card.assigneeInitials && <Avatar name={card.assigneeName} initials={card.assigneeInitials} />}
      </div>
    </div>
  );
}

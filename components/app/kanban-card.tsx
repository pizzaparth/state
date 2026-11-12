"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Menu from "@radix-ui/react-dropdown-menu";
import * as Ctx from "@radix-ui/react-context-menu";
import { Check, ChevronRight, ListChecks, MoreHorizontal, Repeat, StickyNote } from "lucide-react";
import type { DueState } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PRIORITIES } from "@/lib/validation";
import { WEIGHT_LEVELS } from "@/lib/weights";
import { DueLabel, PriorityMark, TICK, WeightMark } from "./primitives";

export interface BoardCard {
  id: string;
  title: string;
  columnId: string;
  projectName: string | null;
  projectSlug: string | null;
  priority: string;
  weight: number;
  due: DueState | null;
  /** Epoch ms, for sorting */
  dueAt: number | null;
  /** YYYY-MM-DD in the viewer's zone, for filters */
  dueDay: string | null;
  /** Epoch ms, for sorting */
  createdAt: number;
  /** Epoch ms; the Done column is ordered by it, newest first */
  completedAt: number | null;
  tags: string[];
  recurring: boolean;
  hasNote: boolean;
  checklist: { done: number; total: number } | null;
  daysInColumn: number;
  /** Not before a later day: greyed at the bottom of its column */
  deferred: boolean;
  deferLabel: string | null;
  /** Added on this screen and not yet saved */
  pending?: boolean;
}

export interface BoardColumn {
  id: string;
  name: string;
  stateType: string;
  wipLimit: number | null;
}

export type CardCommand =
  | { type: "open" }
  | { type: "move"; columnId: string }
  | { type: "complete" }
  | { type: "priority"; priority: string }
  | { type: "weight"; weight: number }
  | { type: "due"; when: "today" | "tomorrow" | "next-week" | "clear" }
  | { type: "delete" };

const PRIORITY_LABEL: Record<string, string> = { none: "None", low: "Low", medium: "Medium", high: "High", critical: "Critical" };

// Dropdown and context menus share their items; both Radix packages have the same parts
type Kit = {
  Item: React.ElementType;
  Sub: React.ElementType;
  SubTrigger: React.ElementType;
  SubContent: React.ElementType;
  Separator: React.ElementType;
  Portal: React.ElementType;
};
const MENU: Kit = Menu;
const CTX: Kit = Ctx;

export const menuContent =
  "app-overlay z-50 min-w-48 rounded-[16px] p-1.5 text-base origin-[var(--radix-dropdown-menu-content-transform-origin)] data-[state=closed]:animate-menu-out data-[state=open]:animate-menu-in";
export const menuItem =
  "flex cursor-pointer items-center gap-2 rounded-[10px] px-3 py-2 text-[#0A0A0A] outline-none data-[highlighted]:bg-black/[0.05] data-[disabled]:cursor-default data-[disabled]:text-[#A1A1AA] [@media(pointer:coarse)]:min-h-11";

function CardMenuItems({ kit: K, card, columns, done, onCommand }: { kit: Kit; card: BoardCard; columns: BoardColumn[]; done: boolean; onCommand: (c: CardCommand) => void }) {
  const sub = (label: string, children: React.ReactNode) => (
    <K.Sub>
      <K.SubTrigger className={cn(menuItem, "justify-between data-[state=open]:bg-black/[0.05]")}>
        {label}…
        <ChevronRight aria-hidden="true" className="size-4 text-[#71717A]" />
      </K.SubTrigger>
      <K.Portal>
        <K.SubContent sideOffset={4} className={menuContent}>
          {children}
        </K.SubContent>
      </K.Portal>
    </K.Sub>
  );
  const current = (on: boolean) => (on ? <Check aria-hidden="true" className="ml-auto size-4 text-accent" /> : null);
  return (
    <>
      <K.Item onSelect={() => onCommand({ type: "open" })} className={menuItem}>
        Open
      </K.Item>
      {!done && (
        <K.Item onSelect={() => onCommand({ type: "complete" })} className={menuItem}>
          Mark done
        </K.Item>
      )}
      {sub(
        "Move to",
        columns
          .filter((c) => c.id !== card.columnId)
          .map((c) => (
            <K.Item key={c.id} onSelect={() => onCommand({ type: "move", columnId: c.id })} className={menuItem}>
              {c.name}
            </K.Item>
          ))
      )}
      {sub(
        "Priority",
        PRIORITIES.map((p) => (
          <K.Item key={p} onSelect={() => onCommand({ type: "priority", priority: p })} className={menuItem}>
            {PRIORITY_LABEL[p]}
            {current(card.priority === p)}
          </K.Item>
        ))
      )}
      {!done &&
        sub(
          "Weight",
          WEIGHT_LEVELS.map((w) => (
            <K.Item key={w.value} onSelect={() => onCommand({ type: "weight", weight: w.value })} className={menuItem}>
              {w.label} <span className="font-mono text-sm text-[#71717A]">+{w.value}</span>
              {current(card.weight === w.value)}
            </K.Item>
          ))
        )}
      {!done &&
        sub(
          "Due",
          (
            [
              ["today", "Today"],
              ["tomorrow", "Tomorrow"],
              ["next-week", "Next week"],
              ["clear", "Clear"],
            ] as const
          ).map(([when, label]) => (
            <K.Item key={when} disabled={when === "clear" && !card.dueAt} onSelect={() => onCommand({ type: "due", when })} className={menuItem}>
              {label}
            </K.Item>
          ))
        )}
      {!done && (
        <>
          <K.Separator className="my-1 h-px bg-black/[0.06]" />
          <K.Item onSelect={() => onCommand({ type: "delete" })} className={cn(menuItem, "text-danger")}>
            Delete
          </K.Item>
        </>
      )}
    </>
  );
}

export function SortableCard({
  card,
  flash,
  href,
  done,
  columns,
  selected,
  selecting,
  onCommand,
  onToggleSelect,
  onOpen,
}: {
  card: BoardCard;
  flash: boolean;
  href?: string;
  done: boolean;
  columns: BoardColumn[];
  selected: boolean;
  /** Some cards are selected: a plain click toggles selection instead of opening. */
  selecting: boolean;
  onCommand: (c: CardCommand) => void;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled: card.pending });
  return (
    <Ctx.Root>
      <Ctx.Trigger asChild>
        <li
          ref={setNodeRef}
          style={{ transform: CSS.Translate.toString(transform), transition }}
          // The placeholder left behind while dragging is inert and dimmed
          inert={isDragging || undefined}
          data-card-id={card.id}
          className={cn("relative", isDragging && "opacity-40")}
        >
          <div
            {...attributes}
            {...listeners}
            aria-roledescription="draggable task"
            aria-label={`${card.title}${selected ? ", selected" : ""}`}
            onKeyDown={(e) => {
              listeners?.onKeyDown?.(e);
              if (e.defaultPrevented) return;
              if (e.key === "Enter") {
                e.preventDefault();
                onOpen();
              } else if (e.key.toLowerCase() === "x" && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                onToggleSelect();
              }
            }}
            className="animate-row-in cursor-grab touch-manipulation rounded-[16px] active:cursor-grabbing"
          >
            <CardFace
              card={card}
              done={done}
              href={href}
              flash={flash}
              selected={selected}
              onComplete={() => onCommand({ type: "complete" })}
              onLinkClick={(e) => {
                if (e.shiftKey || selecting) {
                  e.preventDefault();
                  onToggleSelect();
                }
              }}
            />
          </div>
          {!card.pending && (
            <Menu.Root>
              <Menu.Trigger
                aria-label={`Actions for “${card.title}”`}
                className="absolute right-2 top-2 z-[2] grid size-7 place-items-center rounded-full text-[#52525B] transition-colors hover:bg-black/[0.05] hover:text-[#0A0A0A] data-[state=open]:bg-black/[0.05] [@media(pointer:coarse)]:size-11 [@media(pointer:coarse)]:right-0 [@media(pointer:coarse)]:top-0"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Content align="end" sideOffset={6} className={menuContent}>
                  <CardMenuItems kit={MENU} card={card} columns={columns} done={done} onCommand={onCommand} />
                </Menu.Content>
              </Menu.Portal>
            </Menu.Root>
          )}
        </li>
      </Ctx.Trigger>
      {!card.pending && (
        <Ctx.Portal>
          <Ctx.Content className={cn(menuContent, "origin-[var(--radix-context-menu-content-transform-origin)]")}>
            <CardMenuItems kit={CTX} card={card} columns={columns} done={done} onCommand={onCommand} />
          </Ctx.Content>
        </Ctx.Portal>
      )}
    </Ctx.Root>
  );
}

export function CardFace({
  card,
  done,
  href,
  lifted = false,
  flash = false,
  selected = false,
  onComplete,
  onLinkClick,
}: {
  card: BoardCard;
  done: boolean;
  href?: string;
  lifted?: boolean;
  flash?: boolean;
  selected?: boolean;
  onComplete?: () => void;
  onLinkClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const title = (
    <span className={cn("block text-base font-medium leading-snug", done ? "text-[#52525B] line-through decoration-black/30" : "text-[#0A0A0A]")}>{card.title}</span>
  );
  return (
    <div
      className={cn(
        "relative rounded-[16px] p-3.5 pl-11",
        lifted ? "app-card rotate-[1.5deg] scale-[1.04] cursor-grabbing border-accent bg-white" : "app-card",
        selected && "border-accent bg-accent-soft",
        card.deferred && !lifted && "opacity-60",
        card.pending && "opacity-70"
      )}
    >
      {flash && <span aria-hidden="true" className="pointer-events-none absolute inset-0 animate-flash rounded-[16px] bg-accent/25" />}
      {/* Complete control; done cards show the filled mark */}
      {done ? (
        <span aria-hidden="true" className="absolute left-3.5 top-[17px] size-3 rounded-full bg-accent" />
      ) : onComplete && !card.pending ? (
        <button
          type="button"
          onClick={(e) => (e.stopPropagation(), onComplete())}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Mark “${card.title}” done`}
          title="Mark done"
          className="group/done absolute left-1.5 top-1.5 z-[2] grid size-7 place-items-center rounded-full [@media(pointer:coarse)]:left-0 [@media(pointer:coarse)]:top-0 [@media(pointer:coarse)]:size-11"
        >
          <span aria-hidden="true" className="app-field size-3 rounded-full border border-black/[0.10] transition-transform duration-150 group-hover/done:scale-125 group-hover/done:border-accent" />
        </button>
      ) : (
        <span aria-hidden="true" className="app-field absolute left-3.5 top-[17px] size-3 rounded-full border border-black/[0.10]" />
      )}
      {selected && (
        <span className="absolute -left-1.5 -top-1.5 z-[3] grid size-5 place-items-center rounded-full bg-[#0A0A0A] text-white">
          <Check aria-hidden="true" className="size-3" />
          <span className="sr-only">Selected</span>
        </span>
      )}
      <div className="pr-6">
        {href && !card.pending ? (
          // Stretched link: the whole face opens the task; the buttons above sit over it
          <Link
            href={href as Route}
            scroll={false}
            onClick={onLinkClick}
            draggable={false}
            className="rounded-[6px] after:absolute after:inset-0 after:rounded-[16px] after:content-[''] focus-visible:outline-2"
          >
            {title}
          </Link>
        ) : (
          title
        )}
      </div>
      {card.projectName && <p className={cn(TICK, "mt-1.5 truncate text-[11px] text-[#71717A]")}>{card.projectName}</p>}
      {card.tags.length > 0 && (
        <p className="mt-2 flex min-w-0 flex-wrap gap-1">
          {card.tags.slice(0, 2).map((t) => (
            <span key={t} className="app-field max-w-[8rem] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#52525B]">
              {t}
            </span>
          ))}
          {card.tags.length > 2 && <span className="px-1 font-mono text-[11px] text-[#71717A]">+{card.tags.length - 2}</span>}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {card.deferLabel && !done && <span className="font-mono text-[12px] text-[#52525B]">from {card.deferLabel}</span>}
        {card.due && !done && <DueLabel due={card.due} />}
        <PriorityMark priority={card.priority} />
        {card.recurring && (
          <span title="Repeats" className="text-[#71717A]">
            <Repeat aria-hidden="true" className="size-3.5" />
            <span className="sr-only">Repeats</span>
          </span>
        )}
        {card.checklist ? (
          <span title="Checklist" className="inline-flex items-center gap-1 font-mono text-[12px] tabular-nums text-[#52525B]">
            <ListChecks aria-hidden="true" className="size-3.5" />
            {card.checklist.done}/{card.checklist.total}
          </span>
        ) : (
          card.hasNote && (
            <span title="Has notes" className="text-[#71717A]">
              <StickyNote aria-hidden="true" className="size-3.5" />
              <span className="sr-only">Has notes</span>
            </span>
          )
        )}
        {!done && card.daysInColumn > 2 && (
          <span title={`${card.daysInColumn} days in this column`} className="font-mono text-[12px] tabular-nums text-[#71717A]">
            {card.daysInColumn}d
          </span>
        )}
        <span className="flex-1" />
        <WeightMark weight={card.weight} />
      </div>
    </div>
  );
}

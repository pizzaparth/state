"use client";

import * as React from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, X } from "lucide-react";
import { SORT_FIELDS, SORT_FIELD_NAMES, describeBoardSort, type SortField, type SortKey } from "@/lib/board-sort";
import { cn } from "@/lib/utils";
import { TICK } from "./primitives";

const iconBtn =
  "mi-press grid size-8 shrink-0 place-items-center rounded-full text-[#52525B] transition-colors duration-150 hover:bg-black/[0.05] hover:text-[#0A0A0A] focus-visible:outline-2";

/**
 * Sort keys for the board, in priority order: each key flips direction, moves earlier or
 * is removed; "Sort by" adds one of the unused fields. Empty means manual (drag) order.
 */
export function BoardSortBar({ sort, onChange }: { sort: SortKey[]; onChange: (next: SortKey[]) => void }) {
  const unused = SORT_FIELD_NAMES.filter((f) => !sort.some((k) => k.field === f));
  const add = (field: SortField) => onChange([...sort, { field, dir: SORT_FIELDS[field].defaultDir }]);
  const flip = (i: number) => onChange(sort.map((k, j) => (j === i ? { ...k, dir: k.dir === "asc" ? "desc" : "asc" } : k)));
  const remove = (i: number) => onChange(sort.filter((_, j) => j !== i));
  const earlier = (i: number) => onChange(sort.map((k, j) => (j === i - 1 ? sort[i] : j === i ? sort[i - 1] : k)));

  return (
    <div className="app-panel mb-5 rounded-[20px] p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn(TICK, "px-2 text-[11px] text-[#71717A]")}>Sort</span>
        {sort.length === 0 && <span className="px-1 text-[15px] text-[#52525B]">Manual</span>}
        <ol className="contents">
          {sort.map((key, i) => {
            const meta = SORT_FIELDS[key.field];
            const nextDir = key.dir === "asc" ? "desc" : "asc";
            return (
              <li key={key.field} className="app-card mi-pop inline-flex h-10 min-w-0 items-center gap-0.5 rounded-full pl-3 pr-1">
                {sort.length > 1 && (
                  <span aria-hidden="true" className="mr-1.5 font-mono text-[12px] tabular-nums text-[#71717A]">
                    {i + 1}
                  </span>
                )}
                <span className="text-[15px] font-medium text-[#0A0A0A]">{meta.label}</span>
                <button
                  type="button"
                  onClick={() => flip(i)}
                  aria-label={`${meta.label}: ${meta[key.dir].toLowerCase()}. Switch to ${meta[nextDir].toLowerCase()}`}
                  className="mi-press ml-1 inline-flex h-8 items-center gap-1 rounded-full px-2 text-sm text-[#52525B] transition-colors duration-150 hover:bg-black/[0.05] hover:text-[#0A0A0A] focus-visible:outline-2"
                >
                  {key.dir === "asc" ? <ArrowUp aria-hidden="true" className="size-3.5" /> : <ArrowDown aria-hidden="true" className="size-3.5" />}
                  <span className="whitespace-nowrap">{meta[key.dir]}</span>
                </button>
                {i > 0 && (
                  <button type="button" onClick={() => earlier(i)} aria-label={`Sort by ${meta.label} before ${SORT_FIELDS[sort[i - 1].field].label}`} className={iconBtn}>
                    <ArrowLeft aria-hidden="true" className="size-4" />
                  </button>
                )}
                <button type="button" onClick={() => remove(i)} aria-label={`Stop sorting by ${meta.label}`} className={iconBtn}>
                  <X aria-hidden="true" className="size-4" />
                </button>
              </li>
            );
          })}
        </ol>
        {unused.length > 0 && (
          <Menu.Root>
            <Menu.Trigger className="app-btn mi-press inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium text-[#0A0A0A] data-[state=open]:border-accent">
              <Plus aria-hidden="true" className="size-4" />
              {sort.length === 0 ? "Sort by…" : "Then by…"}
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content
                align="start"
                sideOffset={6}
                className="app-overlay z-50 min-w-52 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-[16px] p-1.5 text-base data-[state=closed]:animate-menu-out data-[state=open]:animate-menu-in"
              >
                {unused.map((field) => (
                  <Menu.Item
                    key={field}
                    onSelect={() => add(field)}
                    className="flex cursor-pointer items-baseline justify-between gap-4 rounded-[10px] px-3 py-2 text-[#0A0A0A] outline-none data-[highlighted]:bg-black/[0.05]"
                  >
                    {SORT_FIELDS[field].label}
                    <span className="font-mono text-[12px] text-[#71717A]">{SORT_FIELDS[field][SORT_FIELDS[field].defaultDir]}</span>
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        )}
        {sort.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="mi-press ml-auto inline-flex h-10 items-center rounded-full px-4 text-[15px] font-medium text-[#52525B] transition-colors duration-150 hover:bg-black/[0.05] hover:text-[#0A0A0A] focus-visible:outline-2"
          >
            Manual order
          </button>
        )}
      </div>
      {sort.length > 0 && <p className="mt-1.5 px-2 font-mono text-[12px] text-[#71717A]">drag moves across columns · order follows sort</p>}
      <p aria-live="polite" className="sr-only">
        {describeBoardSort(sort)}
      </p>
    </div>
  );
}

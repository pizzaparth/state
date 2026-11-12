"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { SHORTCUTS, SHORTCUT_SCOPES } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { TICK } from "@/lib/type";

/** Keys as small caps: "G T" becomes two key caps. */
export function Keys({ keys, className }: { keys: string; className?: string }) {
  const parts = keys === "⌘ K" ? ["⌘", "K"] : keys.split(" ");
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {parts.map((k, i) => (
        <kbd key={i} className="app-btn inline-grid min-w-6 place-items-center rounded-[8px] px-1.5 py-0.5 font-mono text-[13px]">
          {k}
        </kbd>
      ))}
    </span>
  );
}

/** Every shortcut, grouped by where it works (built from lib/shortcuts.ts). */
export function ShortcutList({ columns = 2 }: { columns?: 1 | 2 }) {
  return (
    <div className={cn("grid gap-x-8 gap-y-6", columns === 2 && "sm:grid-cols-2")}>
      {SHORTCUT_SCOPES.map((scope) => {
        const items = SHORTCUTS.filter((s) => s.scope === scope);
        if (items.length === 0) return null;
        return (
          <section key={scope} aria-label={scope}>
            <h3 className={cn(TICK, "mb-2 text-[11px] text-[#71717A]")}>{scope}</h3>
            <dl className="space-y-1.5">
              {items.map((s) => (
                <div key={`${scope}-${s.keys}`} className="flex items-center justify-between gap-4 text-[15px]">
                  <dt className="font-medium text-[#27272A]">{s.label}</dt>
                  <dd>
                    <Keys keys={s.keys} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}

export function ShortcutSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="app-scrim fixed inset-0 z-50 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="app-overlay fixed left-1/2 top-[10vh] z-50 max-h-[80vh] w-[min(40rem,calc(100vw-2rem))] origin-top -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[24px] p-6 outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in"
        >
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold tracking-[-0.01em]">Shortcuts</Dialog.Title>
            <Dialog.Close aria-label="Close shortcuts" className="mi-press grid size-9 place-items-center rounded-full text-[#52525B] hover:bg-black/[0.05] hover:text-[#0A0A0A]">
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <ShortcutList />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

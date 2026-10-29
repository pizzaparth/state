"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { X } from "lucide-react";

/**
 * Right-hand detail panel whose open state lives in the URL (?task= / ?commit=), so it
 * deep-links and Back closes it. Content is rendered on the server and passed in.
 */
export function DetailDrawer({ param, title, children }: { param: string; title: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = React.useState(true);

  const navigateAway = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete(param);
    const query = next.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}` as Route, { scroll: false });
  };

  // Play the exit animation, then drop the URL param (immediately under reduced motion)
  const close = () => {
    setOpen(false);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(navigateAway, reduced ? 0 : 140);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in max-w-[30rem] flex-col overscroll-contain bg-[#0A0A0A] border-l border-white/10 outline-none sm:inset-y-3 sm:right-3 sm:rounded-[28px]"
          aria-describedby={undefined}
          // Inline editors inside the panel use Escape to cancel, not to close
          onEscapeKeyDown={(e) => {
            if (e.target instanceof Element && e.target.closest("[data-drawer-escape]")) e.preventDefault();
          }}
        >
          {/* Close sits in the panel's corner, clear of controls on the content's right edge */}
          <div className="flex items-start justify-between gap-4 pb-4 pl-6 pr-3 pt-3">
            <Dialog.Title className="pt-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#9A9A96]">{title}</Dialog.Title>
            <Dialog.Close className="app-btn grid size-9 place-items-center rounded-full" aria-label="Close">
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

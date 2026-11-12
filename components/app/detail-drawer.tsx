"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { Check, ChevronRight, Link2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TICK } from "@/lib/type";
import { useNotice } from "./notice";

/** Current URL with `remove` dropped and, when given, `set` added. */
function useSwapHref() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (remove: string, set?: { key: string; value: string }) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete(remove);
    if (set) next.set(set.key, set.value);
    const query = next.toString();
    return `${pathname}${query ? `?${query}` : ""}` as Route;
  };
}

/**
 * Right-hand inspector whose open state lives in the URL (?task= / ?commit=), so it
 * deep-links and Back closes it. Content is rendered on the server and passed in.
 *
 *   header   kind badge · where the object lives · copy link · close
 *   body     scrolls on its own; sections rise in one after another
 */
export function DetailDrawer({
  param,
  title,
  crumbs = [],
  children,
}: {
  param: string;
  /** The object's kind ("Task", "Commit"); names the dialog. */
  title: string;
  /** Where the object lives, outermost first (project, board, column). */
  crumbs?: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const swapHref = useSwapHref();
  const [open, setOpen] = React.useState(true);
  const [scrolled, setScrolled] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Play the exit animation, then drop the URL param (immediately under reduced motion)
  const close = () => {
    setOpen(false);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => router.replace(swapHref(param), { scroll: false }), reduced ? 0 : 140);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 app-scrim data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full max-w-[34rem] flex-col overflow-hidden bg-white outline-none",
            "pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]",
            "data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in",
            "sm:inset-y-2 sm:right-2 sm:rounded-[24px] sm:border sm:border-black/[0.08] sm:pb-0 sm:pt-0"
          )}
          aria-describedby={undefined}
          ref={contentRef}
          // Focus the panel itself, not its first button (copy link), so Tab starts at
          // the top and no focus ring flashes on open
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            contentRef.current?.focus();
          }}
          // Inline editors inside the panel use Escape to cancel, not to close
          onEscapeKeyDown={(e) => {
            if (e.target instanceof Element && e.target.closest("[data-drawer-escape]")) e.preventDefault();
          }}
        >
          <header
            className={cn(
              "flex h-14 shrink-0 items-center gap-2 border-b px-3 transition-colors duration-150 sm:px-4",
              scrolled ? "border-black/[0.08]" : "border-transparent"
            )}
          >
            <Dialog.Title className={cn(TICK, "inline-flex shrink-0 items-center gap-2 rounded-full bg-[#F5F5F5] py-1 pl-2.5 pr-3 text-[11px] text-[#0A0A0A]")}>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
              {title}
            </Dialog.Title>
            {crumbs.length > 0 && (
              <nav aria-label="Location" className="min-w-0 flex-1">
                <ol className="flex min-w-0 items-center gap-1 text-sm text-[#71717A]">
                  {crumbs.map((c, i) => (
                    <li key={`${c}-${i}`} className={cn("flex min-w-0 items-center gap-1", i === crumbs.length - 1 && "text-[#0A0A0A]")}>
                      {i > 0 && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-[#A1A1AA]" />}
                      <span className="truncate">{c}</span>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <CopyLinkButton />
              <kbd aria-hidden="true" className="mx-1 hidden rounded-[6px] border border-black/[0.10] px-1.5 py-0.5 font-mono text-[11px] text-[#71717A] [@media(pointer:fine)]:inline">
                Esc
              </kbd>
              <Dialog.Close className="mi-press grid size-9 place-items-center rounded-full text-[#52525B] transition-colors hover:bg-black/[0.05] hover:text-[#0A0A0A]" aria-label={`Close ${title.toLowerCase()}`}>
                <X className="size-[18px]" aria-hidden="true" />
              </Dialog.Close>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-10 pt-2 sm:px-7" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CopyLinkButton() {
  const notify = useNotice();
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      aria-label="Copy link"
      title="Copy link"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          notify("Link copied.");
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          notify("Could not copy the link.");
        }
      }}
      className="mi-press grid size-9 place-items-center rounded-full text-[#52525B] transition-colors hover:bg-black/[0.05] hover:text-[#0A0A0A]"
    >
      {copied ? <Check className="mi-pop size-4 text-accent" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
    </button>
  );
}

/** Opens a related object in the same panel (task ↔ its commit), replacing this one. */
export function PanelLink({
  from,
  to,
  id,
  className,
  children,
}: {
  from: string;
  to: string;
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const swapHref = useSwapHref();
  return (
    <Link href={swapHref(from, { key: to, value: id })} replace scroll={false} className={className}>
      {children}
    </Link>
  );
}

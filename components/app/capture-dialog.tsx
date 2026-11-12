"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { QuickCapture } from "./quick-capture";

/**
 * Capture from anywhere (N, the palette, the phone + sheet). Enter saves to the Inbox and
 * keeps the dialog open for the next one; ⌘/Ctrl+Enter saves and closes; Shift+Enter
 * saves straight to Queued. The text is kept as a draft if the dialog closes unsaved.
 */
export function CaptureDialog({
  open,
  onOpenChange,
  projects,
  tz,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: { slug: string; name: string }[];
  tz: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="app-scrim fixed inset-0 z-50 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="app-overlay fixed left-1/2 top-[14vh] z-50 w-[min(36rem,calc(100vw-2rem))] origin-top -translate-x-1/2 overscroll-contain rounded-[28px] p-5 outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in"
        >
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold tracking-[-0.01em]">Add task</Dialog.Title>
            <Dialog.Close aria-label="Close" className="mi-press grid size-9 place-items-center rounded-full text-[#52525B] hover:bg-black/[0.05]">
              <X aria-hidden="true" className="size-4" />
            </Dialog.Close>
          </div>
          <QuickCapture projects={projects} tz={tz} draftKey="state:draft:capture-dialog" inputRef={inputRef} onCaptured={(close) => close && onOpenChange(false)} />
          <p className="mt-1 px-2 font-mono text-[12px] text-[#71717A]">
            <kbd>↵</kbd> inbox · <kbd>⇧&nbsp;↵</kbd> queued · <kbd>⌘&nbsp;↵</kbd> save &amp; close
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

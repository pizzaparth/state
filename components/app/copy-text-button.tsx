"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { useNotice } from "./notice";

/** Copies prepared plain text to the clipboard. */
export function CopyTextButton({ text, label = "Copy as text" }: { text: string; label?: string }) {
  const notify = useNotice();
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          notify("Copied.");
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          notify("Could not copy.");
        }
      }}
      className="app-btn mi-press inline-flex h-10 items-center gap-1.5 rounded-[12px] px-4 text-sm font-medium"
    >
      {copied ? <Check aria-hidden="true" className="mi-pop size-4 text-accent" /> : <Copy aria-hidden="true" className="size-4" />}
      {label}
    </button>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { DISPLAY, TICK } from "@/lib/type";

/** Shared layout for the product's error and not-found states: short title, next steps. */
export function Fallback({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <section className="app-panel mx-auto mt-10 max-w-xl px-6 py-10 text-center">
      <p className={cn(TICK, "text-accent")}>{label}</p>
      <h1 className={cn(DISPLAY, "mt-3 text-[2.5rem] leading-none text-[#0A0A0A]")}>{title}</h1>
      <div className="mt-8 flex flex-wrap justify-center gap-2">{children}</div>
    </section>
  );
}

export const fallbackPrimary = "app-inverse mi-press inline-flex h-11 items-center gap-2 rounded-[12px] px-4 text-base font-semibold";
export const fallbackSecondary = "app-btn mi-press inline-flex h-11 items-center gap-2 rounded-[12px] px-4 text-base font-medium";

/** Link to the list one level up (/platform/projects/x → /platform/projects). */
export function ParentLink() {
  const pathname = usePathname() ?? "/platform/today";
  const parts = pathname.split("/").filter(Boolean);
  const parent = parts.length > 2 ? `/${parts.slice(0, -1).join("/")}` : "/platform/today";
  const name = parent.split("/").pop() ?? "today";
  return (
    <Link href={parent as Route} className={fallbackSecondary}>
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to {name.charAt(0).toUpperCase() + name.slice(1)}
    </Link>
  );
}

export function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button type="button" onClick={onRetry} className={fallbackPrimary}>
      <RotateCcw className="size-4" aria-hidden="true" />
      Try again
    </button>
  );
}

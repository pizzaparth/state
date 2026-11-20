"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DISPLAY, TICK } from "@/lib/type";
import { fallbackPrimary } from "@/components/app/fallback";

/** Full-screen state while the demo's database opens, or when it cannot. */
export function DemoStatus({ failed }: { failed: boolean }) {
  return (
    <main className="flex h-[100dvh] items-center justify-center px-4">
      <section role="status" aria-live="polite" className="text-center">
        <p className={cn(TICK, "text-accent")}>Demo</p>
        {failed ? (
          <>
            <h1 className={cn(DISPLAY, "mt-3 text-[2rem] leading-none text-[#0A0A0A]")}>Could not open</h1>
            <Link href="/demo" className={cn(fallbackPrimary, "mt-8")}>
              Start a new demo
            </Link>
          </>
        ) : (
          <h1 className={cn(DISPLAY, "mt-3 flex items-center gap-3 text-[2rem] leading-none text-[#0A0A0A]")}>
            <Loader2 aria-hidden="true" className="size-6 animate-spin text-accent" />
            Preparing…
          </h1>
        )}
      </section>
    </main>
  );
}

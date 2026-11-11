"use client";

import * as React from "react";
import { signOutAction } from "@/app/(auth)/actions";
import { demoTabAlive, serveDemoTab } from "@/lib/demo/tab";

/**
 * Ends a demo whose tab was closed (lib/demo/tab.ts). Renders nothing; the product
 * stays usable while the check runs, and a refresh keeps the demo.
 */
export function DemoGuard({ userId }: { userId: string }) {
  React.useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    void demoTabAlive(userId).then(async (alive) => {
      if (cancelled) return;
      if (alive) {
        stop = serveDemoTab(userId);
        return;
      }
      await signOutAction();
      window.location.replace("/?demo=ended");
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [userId]);
  return null;
}

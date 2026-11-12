"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { startDemoAction } from "../actions";
import { markDemoTab } from "@/lib/demo/tab";

/** Starts the demo as soon as the page loads; the button retries after an error. */
export function DemoStarter() {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const started = React.useRef(false);

  const start = React.useCallback(() => {
    setError(null);
    startTransition(async () => {
      let timezone: string | undefined;
      try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
      } catch {
        timezone = undefined;
      }
      const result = await startDemoAction(timezone ? { timezone } : undefined);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.userId) markDemoTab(result.userId);
      // Full load so the product starts from a fresh session
      window.location.replace("/platform/today");
    });
  }, []);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);

  return (
    <div className="space-y-3">
      <Button type="button" variant="light-cta" size="md" className="w-full" isLoading={pending || !error} onClick={start}>
        {pending || !error ? "Preparing demo…" : "Try again"}
      </Button>
      <p aria-live="polite" className="min-h-5 text-sm text-danger">
        {error}
      </p>
    </div>
  );
}

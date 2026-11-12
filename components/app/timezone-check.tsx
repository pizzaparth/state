"use client";

import * as React from "react";
import { setTimezoneAction } from "@/app/(app)/client-actions";
import { useNotice } from "./notice";

const DISMISSED_KEY = "state:tz-offered";

/**
 * Compares the browser's zone with the saved one once per page load. A demo follows the
 * device silently; the owner gets one notice with a Switch action, offered once per
 * (saved, device) pair so it does not nag on every load.
 */
export function TimezoneCheck({ tz, demo }: { tz: string; demo: boolean }) {
  const notify = useNotice();
  React.useEffect(() => {
    let device: string | undefined;
    try {
      device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!device || device === tz) return;
    if (demo) {
      void setTimezoneAction({ timezone: device });
      return;
    }
    const pair = `${tz}>${device}`;
    try {
      if (window.localStorage.getItem(DISMISSED_KEY) === pair) return;
      window.localStorage.setItem(DISMISSED_KEY, pair);
    } catch {
      // Storage blocked: offer it anyway
    }
    const zone = device;
    notify(`Your device is on ${zone}. Switch?`, {
      label: "Switch",
      run: async () => {
        const result = await setTimezoneAction({ timezone: zone });
        notify(result.ok ? `Time zone set to ${zone}.` : result.error);
      },
    });
  }, [tz, demo, notify]);
  return null;
}

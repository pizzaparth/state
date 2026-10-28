import * as React from "react";

/**
 * Re-mounts on each route change (not on ?query changes), so every page enters with
 * one short fade and rise. Opening a task or commit panel does not replay it.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in space-y-8">{children}</div>;
}

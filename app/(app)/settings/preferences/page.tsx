import * as React from "react";
import { getViewer } from "@/lib/viewer";
import { PageHeader, Panel } from "@/components/app/primitives";
import { Row, SettingsNav } from "@/components/app/settings-nav";

export const metadata = { title: "Preferences — State" };

const SHORTCUTS = [
  ["⌘ K", "Command palette"],
  ["/", "Search"],
  ["C", "Record a commit"],
  ["N", "Capture a task"],
  ["G T", "Today"],
  ["G I", "Inbox"],
  ["G A", "Activity"],
  ["G H", "History"],
  ["G M", "Metrics"],
  ["G P", "Personal board"],
  ["G O", "Organisation"],
] as const;

const WEIGHTS = [
  ["Small", 1],
  ["Normal", 2],
  ["Major", 4],
  ["Milestone", 8],
] as const;

export default async function PreferencesSettingsPage() {
  const viewer = await getViewer();
  return (
    <>
      <PageHeader label="Settings" title="Preferences" />
      <SettingsNav active="/settings/preferences" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Execution">
          <dl>
            <Row label="Daily target" hint="Shown on Today as progress toward the day.">
              <span className="tabular-nums">{viewer.dailyExecutionTarget ?? "Not set"}</span>
            </Row>
            <Row label="Task weights" hint="Execution = Σ completed task weights + manual commit weights.">
              <span className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                {WEIGHTS.map(([name, w]) => (
                  <span key={name}>
                    {name} <span className="text-[#5F5F5B]">{w}</span>
                  </span>
                ))}
              </span>
            </Row>
          </dl>
        </Panel>
        <Panel title="Keyboard shortcuts">
          <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-y-2 text-sm">
            {SHORTCUTS.map(([keys, action]) => (
              <React.Fragment key={keys}>
                <dt>
                  <kbd className="neu-raised-sm inline-block rounded-[8px] px-2 py-0.5 font-mono text-xs">{keys.replace(" ", " ")}</kbd>
                </dt>
                <dd className="text-[#3A3A38]">{action}</dd>
              </React.Fragment>
            ))}
          </dl>
        </Panel>
      </div>
    </>
  );
}

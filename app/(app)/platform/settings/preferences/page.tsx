import * as React from "react";
import { getViewer } from "@/lib/viewer";
import { PageHeader, Panel } from "@/components/app/primitives";
import { Row, SettingsNav } from "@/components/app/settings-nav";
import { WEIGHT_LEVELS } from "@/lib/weights";

export const metadata = { title: "Preferences — State" };

const SHORTCUTS = [
  ["⌘ K", "Commands"],
  ["/", "Search"],
  ["C", "Log work"],
  ["N", "Add task"],
  ["G T", "Today"],
  ["G I", "Inbox"],
  ["G A", "Activity"],
  ["G H", "History"],
  ["G M", "Metrics"],
  ["G P", "Board"],
  ["G O", "Organisation"],
] as const;

export default async function PreferencesSettingsPage() {
  // Signed-in only: redirects to /login otherwise
  await getViewer();
  return (
    <>
      <PageHeader label="Settings" title="Preferences" />
      <SettingsNav active="/platform/settings/preferences" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Execution">
          <dl>
            <Row label="Weights" hint="execution = Σ task + manual weights">
              <ul className="space-y-2">
                {WEIGHT_LEVELS.map((w) => (
                  <li key={w.value}>
                    {w.label} <span className="font-mono font-semibold tabular-nums text-[#F2F2EF]">+{w.value}</span>
                    <span className="block text-sm font-normal leading-relaxed text-[#9A9A96]">{w.hint}</span>
                  </li>
                ))}
              </ul>
            </Row>
          </dl>
        </Panel>
        <Panel title="Shortcuts">
          <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-y-2 text-base">
            {SHORTCUTS.map(([keys, action]) => (
              <React.Fragment key={keys}>
                <dt>
                  <kbd className="app-btn inline-block rounded-[8px] px-2 py-0.5 font-mono text-sm">{keys.replace(" ", " ")}</kbd>
                </dt>
                <dd className="font-medium text-[#D4D4D0]">{action}</dd>
              </React.Fragment>
            ))}
          </dl>
        </Panel>
      </div>
    </>
  );
}

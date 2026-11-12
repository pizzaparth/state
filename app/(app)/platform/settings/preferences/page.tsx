import * as React from "react";
import { getViewer } from "@/lib/viewer";
import { PageHeader, Panel } from "@/components/app/primitives";
import { Row, SettingsNav } from "@/components/app/settings-nav";
import { WEIGHT_LEVELS } from "@/lib/weights";
import { ShortcutList } from "@/components/app/shortcut-sheet";

export const metadata = { title: "Preferences" };


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
                    {w.label} <span className="font-mono font-semibold tabular-nums text-[#0A0A0A]">+{w.value}</span>
                    <span className="block text-sm font-normal leading-relaxed text-[#52525B]">{w.hint}</span>
                  </li>
                ))}
              </ul>
            </Row>
          </dl>
        </Panel>
        <Panel title="Shortcuts">
          <ShortcutList columns={1} />
        </Panel>
      </div>
    </>
  );
}

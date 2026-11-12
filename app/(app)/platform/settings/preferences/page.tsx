import * as React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { getViewer } from "@/lib/viewer";
import { localeFromHeader } from "@/lib/preferences";
import { timeZones } from "@/lib/tz";
import { PageHeader, Panel } from "@/components/app/primitives";
import { Row, SettingsNav } from "@/components/app/settings-nav";
import { WEIGHT_LEVELS } from "@/lib/weights";
import { ShortcutList } from "@/components/app/shortcut-sheet";
import { TimezoneField } from "@/components/app/timezone-field";
import { PreferenceField } from "@/components/app/preference-controls";

export const metadata = { title: "Preferences" };

export default async function PreferencesSettingsPage() {
  const viewer = await getViewer();
  const detected = localeFromHeader((await headers()).get("accept-language")) ?? "en-GB";
  const field = (name: keyof typeof viewer.preferences) => <PreferenceField name={name} prefs={viewer.preferences} detected={detected} />;
  return (
    <>
      <PageHeader label="Settings" title="Preferences" />
      <SettingsNav active="/platform/settings/preferences" />
      <Panel title="Personal">
        <dl>
          <Row label="Time zone" hint="your day starts at 00:00 here">
            <TimezoneField timezone={viewer.tz} zones={timeZones()} />
          </Row>
          <Row label="Language" hint="dates and numbers">
            {field("locale")}
          </Row>
          <Row label="Week starts" hint="calendar, weekday profile, weekly ledger">
            {field("weekStart")}
          </Row>
          <Row label="Default weight" hint="tasks without +N">
            {field("defaultWeight")}
          </Row>
          <Row label="Start page" hint="after signing in">
            {field("startPage")}
          </Row>
          <Row label="Done window" hint="board, Done column">
            {field("doneWindow")}
          </Row>
          <Row label="Background motion" hint="parallax layers">
            {field("motion")}
          </Row>
          <Row label="First-run setup">
            <Link href="/platform/start" className="app-btn mi-press inline-flex h-10 items-center rounded-[12px] px-4 text-sm font-medium">
              Run setup again
            </Link>
          </Row>
        </dl>
      </Panel>
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

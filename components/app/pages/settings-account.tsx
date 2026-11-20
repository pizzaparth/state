import * as React from "react";
import { getAccount, getDeletedTasks } from "@/db/queries";
import { RestoreButton } from "@/components/app/record-actions";
import { formatDate } from "@/lib/format";
import { definePage, type PageContext } from "@/lib/pages/types";
import { PageHeader, Panel } from "@/components/app/primitives";
import { Row, SettingsNav } from "@/components/app/settings-nav";
import { SignOutButton } from "@/components/app/sign-out-button";
import { ExportLinks, ImportForm } from "@/components/app/data-transfer";
import { TimezoneField } from "@/components/app/timezone-field";
import { timeZones } from "@/lib/tz";

async function load({ viewer }: PageContext) {
  const [account, deleted] = await Promise.all([getAccount(viewer.id), getDeletedTasks(viewer.workspaceIds)]);
  return { props: { viewer, account, deleted } };
}

type Props = Awaited<ReturnType<typeof load>>["props"];

function View({ viewer, account, deleted }: Props) {
  return (
    <>
      <PageHeader label="Settings" title="Account" />
      <SettingsNav active="/platform/settings/account" />
      <Panel title="Profile">
        <dl>
          <Row label="Name">{account?.name}</Row>
          <Row label="Account" hint={viewer.isDemo ? "in this browser; gone on sign-out or tab close" : "the only permanent account"}>
            {viewer.isDemo ? "Demo" : "Owner"}
          </Row>
          <Row label="Time zone" hint="your day starts at 00:00 here">
            <TimezoneField timezone={account?.timezone ?? viewer.tz} zones={timeZones()} />
          </Row>
          <Row label="Since">{account ? formatDate(account.createdAt, viewer.tz, { day: "numeric", month: "long", year: "numeric" }) : ""}</Row>
        </dl>
      </Panel>
      <Panel title="Your data">
        <dl>
          <Row label="Export" hint="personal workspace">
            <ExportLinks />
          </Row>
          <Row label="Import" hint="into your personal workspace">
            <ImportForm />
          </Row>
          <Row label="Deleted tasks" hint="kept 30 days, then removed">
            {deleted.length === 0 ? (
              <span className="font-normal text-[#71717A]">None</span>
            ) : (
              <ul className="space-y-1.5">
                {deleted.map((t) => (
                  <li key={t.id} className="flex min-w-0 items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate">{t.title}</span>
                      <span className="block font-mono text-[12px] font-normal text-[#71717A]">
                        {[t.projectName, t.deletedAt ? `deleted ${formatDate(t.deletedAt, viewer.tz)}` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <RestoreButton kind="task" id={t.id} name={t.title} />
                  </li>
                ))}
              </ul>
            )}
          </Row>
        </dl>
      </Panel>
      <Panel title="Session">
        <SignOutButton demo={viewer.isDemo} />
      </Panel>
    </>
  );
}

export default definePage({ load, View });

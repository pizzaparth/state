import * as React from "react";
import { getAccount } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { formatDate } from "@/lib/format";
import { PageHeader, Panel } from "@/components/app/primitives";
import { Row, SettingsNav } from "@/components/app/settings-nav";

export const metadata = { title: "Account — State" };

export default async function AccountSettingsPage() {
  const viewer = await getViewer();
  const account = await getAccount(viewer.id);
  return (
    <>
      <PageHeader label="Settings" title="Account" />
      <SettingsNav active="/settings/account" />
      <Panel title="Profile">
        <dl>
          <Row label="Name">{account?.name}</Row>
          <Row label="Email">{account?.email}</Row>
          <Row label="Username">{account?.username ?? "Not set"}</Row>
          <Row label="Timezone" hint="Days in graphs and history start at midnight in this timezone.">
            {account?.timezone}
          </Row>
          <Row label="Member since">{account ? formatDate(account.createdAt, viewer.tz, { day: "numeric", month: "long", year: "numeric" }) : ""}</Row>
        </dl>
      </Panel>
      <Panel title="Your data">
        <p className="max-w-[62ch] text-base leading-relaxed text-[#9A9A96]">
          Tasks, commits, projects, tags and metrics are yours. Export as CSV or JSON is part of the plan and stays available for
          90 days after cancellation.
        </p>
      </Panel>
    </>
  );
}

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
          <Row label="Timezone" hint="your day starts at 00:00 here">
            {account?.timezone}
          </Row>
          <Row label="Since">{account ? formatDate(account.createdAt, viewer.tz, { day: "numeric", month: "long", year: "numeric" }) : ""}</Row>
        </dl>
      </Panel>
      <Panel title="Your data">
        <p className="font-mono text-sm text-[#9A9A96]">
          <span className="text-[#F2F2EF]">100% yours.</span> CSV/JSON export · kept 90 days after you cancel.
        </p>
      </Panel>
    </>
  );
}

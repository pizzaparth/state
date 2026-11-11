import * as React from "react";
import { getAccount, hasPassword } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { formatDate } from "@/lib/format";
import { PageHeader, Panel } from "@/components/app/primitives";
import { Row, SettingsNav } from "@/components/app/settings-nav";
import { SignOutButton } from "@/components/app/sign-out-button";
import { ExportLinks, ImportForm } from "@/components/app/data-transfer";
import { DeleteAccount } from "@/components/app/delete-account";

export const metadata = { title: "Account" };

export default async function AccountSettingsPage() {
  const viewer = await getViewer();
  const [account, needsPassword] = await Promise.all([getAccount(viewer.id), hasPassword(viewer.id)]);
  return (
    <>
      <PageHeader label="Settings" title="Account" />
      <SettingsNav active="/platform/settings/account" />
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
        <dl>
          <Row label="Export" hint="personal workspace">
            <ExportLinks />
          </Row>
          <Row label="Import" hint="into your personal workspace">
            <ImportForm />
          </Row>
        </dl>
      </Panel>
      <Panel title="Session">
        <SignOutButton />
      </Panel>
      <Panel title="Delete account">
        <DeleteAccount email={viewer.email} needsPassword={needsPassword} />
      </Panel>
    </>
  );
}

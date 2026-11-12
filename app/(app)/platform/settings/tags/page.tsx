import * as React from "react";
import { getTagsWithCounts } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { PageHeader, Panel } from "@/components/app/primitives";
import { SettingsNav } from "@/components/app/settings-nav";
import { TagManager } from "@/components/app/tag-manager";

export const metadata = { title: "Tags" };

export default async function TagSettingsPage() {
  const viewer = await getViewer();
  const tags = await getTagsWithCounts(viewer.workspaceIds);
  return (
    <>
      <PageHeader label="Settings" title="Tags" />
      <SettingsNav active="/platform/settings/tags" />
      <Panel title="Tags" aside={`${tags.length}`}>
        <TagManager tags={tags} />
      </Panel>
    </>
  );
}

import * as React from "react";
import { getTagsWithCounts } from "@/db/queries";
import { definePage, type PageContext } from "@/lib/pages/types";
import { PageHeader, Panel } from "@/components/app/primitives";
import { SettingsNav } from "@/components/app/settings-nav";
import { TagManager } from "@/components/app/tag-manager";

async function load({ viewer }: PageContext) {
  return { props: { tags: await getTagsWithCounts(viewer.workspaceIds) } };
}

type Props = Awaited<ReturnType<typeof load>>["props"];

function View({ tags }: Props) {
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

export default definePage({ load, View });

import * as React from "react";
import { getOnboardingState } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { PageHeader, Panel } from "@/components/app/primitives";
import { Onboarding, SkipSetup } from "@/components/app/onboarding";

export const metadata = { title: "Set up" };

/** First-run setup. Each step reads its state from the person's own personal board. */
export default async function StartPage() {
  const viewer = await getViewer();
  const state = await getOnboardingState(viewer.id, viewer.personalWorkspaceId, viewer.personalBoardId);
  const canCreateOrganisation = false;

  return (
    <>
      <PageHeader label="Start" title="Set up" actions={<SkipSetup />} />
      <Panel>
        <Onboarding canCreateOrganisation={canCreateOrganisation} organisations={viewer.orgs.map((o) => o.name)} {...state} />
      </Panel>
    </>
  );
}

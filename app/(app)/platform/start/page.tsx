import * as React from "react";
import { getOnboardingState } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { hasOrganisationPlan } from "@/lib/billing/access";
import { PageHeader, Panel } from "@/components/app/primitives";
import { Onboarding, SkipSetup } from "@/components/app/onboarding";

export const metadata = { title: "Set up" };

/** First-run setup. Each step reads its state from the person's own personal board. */
export default async function StartPage() {
  const viewer = await getViewer();
  const [canCreateOrganisation, state] = await Promise.all([
    hasOrganisationPlan(viewer.id),
    getOnboardingState(viewer.id, viewer.personalWorkspaceId, viewer.personalBoardId),
  ]);

  return (
    <>
      <PageHeader label="Start" title="Set up" actions={<SkipSetup />} />
      <Panel>
        <Onboarding canCreateOrganisation={canCreateOrganisation} organisations={viewer.orgs.map((o) => o.name)} {...state} />
      </Panel>
    </>
  );
}

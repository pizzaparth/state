import * as React from "react";
import { getDailyExecution, getOnboardingState } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { PageHeader, Panel } from "@/components/app/primitives";
import { Onboarding, SkipSetup } from "@/components/app/onboarding";

export const metadata = { title: "Set up" };

/** First-run setup. Each step reads its state from the person's own personal board. */
export default async function StartPage() {
  const viewer = await getViewer();
  const [state, graph] = await Promise.all([
    getOnboardingState(viewer.id, viewer.personalWorkspaceId, viewer.personalBoardId),
    getDailyExecution({ workspaceIds: viewer.workspaceIds, userId: viewer.id }, viewer.tz, 28),
  ]);

  return (
    <>
      <PageHeader label="Start" title="Set up" actions={<SkipSetup />} />
      <Panel>
        <Onboarding {...state} graph={graph} />
      </Panel>
    </>
  );
}

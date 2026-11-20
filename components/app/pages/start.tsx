import * as React from "react";
import { getDailyExecution, getOnboardingState } from "@/db/queries";
import { definePage, type PageContext } from "@/lib/pages/types";
import { PageHeader, Panel } from "@/components/app/primitives";
import { Onboarding, SkipSetup } from "@/components/app/onboarding";

/** First-run setup. Each step reads its state from the person's own personal board. */
async function load({ viewer }: PageContext) {
  const [state, graph] = await Promise.all([
    getOnboardingState(viewer.id, viewer.personalWorkspaceId, viewer.personalBoardId),
    getDailyExecution({ workspaceIds: viewer.workspaceIds, userId: viewer.id }, viewer.tz, 28),
  ]);
  return { props: { state, graph } };
}

type Props = Awaited<ReturnType<typeof load>>["props"];

function View({ state, graph }: Props) {
  return (
    <>
      <PageHeader label="Start" title="Set up" actions={<SkipSetup />} />
      <Panel>
        <Onboarding {...state} graph={graph} />
      </Panel>
    </>
  );
}

export default definePage({ load, View });

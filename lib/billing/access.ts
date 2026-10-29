import { and, eq, inArray, gt, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";

/**
 * Paid access check. Active and past_due (grace period) subscriptions grant access;
 * a canceled subscription keeps access until its paid period ends.
 * TODO: past_due should become read-only after the grace period (docs/state_desc.md §40).
 */
export async function hasPaidAccess(userId: string): Promise<boolean> {
  return hasAccessFrom(userId);
}

/** Paid access on the Organisation plan, which is what lets a person create organisations. */
export async function hasOrganisationPlan(userId: string): Promise<boolean> {
  return hasAccessFrom(userId, "organisation");
}

async function hasAccessFrom(userId: string, plan?: string): Promise<boolean> {
  const now = new Date();
  const [row] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        plan ? eq(subscriptions.plan, plan) : undefined,
        or(
          inArray(subscriptions.status, ["active", "past_due"]),
          and(
            eq(subscriptions.status, "canceled"),
            or(isNull(subscriptions.currentPeriodEnd), gt(subscriptions.currentPeriodEnd, now))
          )
        )
      )
    )
    .limit(1);
  return Boolean(row);
}

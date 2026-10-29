import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";

/** Days a past_due subscription keeps full access while the provider retries the charge. */
export const PAST_DUE_GRACE_DAYS = 7;

/**
 * What a person may do in the product (docs/state_desc.md §40):
 *
 *   full        active; past_due within the grace period; canceled until its paid period ends
 *   read_only   past_due after the grace period; canceled or expired after the period ended.
 *               Everything stays readable and exportable; every write is refused.
 *   none        never paid (no subscription, or only an incomplete checkout): goes to checkout
 */
export type Access = "full" | "read_only" | "none";

export interface AccessState {
  access: Access;
  /** Why access is read-only, for the banner. */
  reason: "past_due" | "ended" | null;
}

export async function getAccess(userId: string): Promise<AccessState> {
  const rows = await db
    .select({ plan: subscriptions.plan, status: subscriptions.status, currentPeriodEnd: subscriptions.currentPeriodEnd, pastDueSince: subscriptions.pastDueSince })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(20);
  return accessFrom(rows);
}

/** Pure decision over a person's subscription rows (exported for tests). */
export function accessFrom(
  rows: { plan: string; status: string; currentPeriodEnd: Date | null; pastDueSince: Date | null }[],
  now = new Date(),
  plan?: string
): AccessState {
  const graceStart = now.getTime() - PAST_DUE_GRACE_DAYS * 86_400_000;
  const relevant = plan ? rows.filter((r) => r.plan === plan) : rows;
  const full = relevant.some(
    (r) =>
      r.status === "active" ||
      (r.status === "past_due" && (!r.pastDueSince || r.pastDueSince.getTime() > graceStart)) ||
      (r.status === "canceled" && (!r.currentPeriodEnd || r.currentPeriodEnd.getTime() > now.getTime()))
  );
  if (full) return { access: "full", reason: null };
  if (rows.some((r) => r.status === "past_due")) return { access: "read_only", reason: "past_due" };
  if (rows.some((r) => r.status === "canceled" || r.status === "expired")) return { access: "read_only", reason: "ended" };
  return { access: "none", reason: null };
}

/** Full access: may write. Read-only and unpaid accounts may not. */
export async function hasPaidAccess(userId: string): Promise<boolean> {
  return (await getAccess(userId)).access === "full";
}

/** Full access on the Organisation plan, which is what lets a person create organisations. */
export async function hasOrganisationPlan(userId: string): Promise<boolean> {
  const rows = await db
    .select({ plan: subscriptions.plan, status: subscriptions.status, currentPeriodEnd: subscriptions.currentPeriodEnd, pastDueSince: subscriptions.pastDueSince })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(20);
  return accessFrom(rows, new Date(), "organisation").access === "full";
}

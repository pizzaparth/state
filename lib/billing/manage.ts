import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { MutationError } from "@/lib/authz";
import { formatDate } from "@/lib/format";
import { razorpay, stripe } from "./index";

/**
 * Self-serve renewal controls for the recurring subscription (both plans). Changes are
 * made at the provider first; the local row mirrors them so the page is right at once,
 * and the provider's webhook stays the source of truth afterwards.
 */

// Statuses the provider will still charge
const BILLABLE = ["incomplete", "active", "past_due"];

async function currentSubscription(userId: string) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), inArray(subscriptions.status, ["active", "past_due"])))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);
  return row ?? null;
}

/**
 * Turns auto-renew off (cancel at period end) or back on. Razorpay cannot undo a
 * scheduled cancellation, so renewing there means subscribing again once it ends.
 */
export async function setAutoRenew(userId: string, renew: boolean): Promise<{ renew: boolean; endsAt: Date | null }> {
  const sub = await currentSubscription(userId);
  if (!sub?.providerSubscriptionId) throw new MutationError("not_found", "No active subscription.");
  if (sub.cancelAtPeriodEnd === !renew) return { renew, endsAt: sub.currentPeriodEnd };

  if (sub.provider === "stripe") {
    if (!stripe) throw new MutationError("invalid", "Billing is unavailable right now. Try again shortly.");
    await stripe.subscriptions.update(sub.providerSubscriptionId, { cancel_at_period_end: !renew });
  } else if (sub.provider === "razorpay") {
    if (renew) {
      const [{ tz }] = await db.select({ tz: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
      const end = sub.currentPeriodEnd ? ` after ${formatDate(sub.currentPeriodEnd, tz, { day: "numeric", month: "long" })}` : "";
      throw new MutationError("invalid", `Razorpay can't undo a cancellation. Subscribe again${end}.`);
    }
    if (!razorpay) throw new MutationError("invalid", "Billing is unavailable right now. Try again shortly.");
    await razorpay.subscriptions.cancel(sub.providerSubscriptionId, true);
  }
  // "dev" subscriptions (lib/billing/skip.ts) only change locally

  await db.update(subscriptions).set({ cancelAtPeriodEnd: !renew }).where(eq(subscriptions.id, sub.id));
  return { renew, endsAt: sub.currentPeriodEnd };
}

/**
 * Stops every subscription the provider could still charge, immediately. Used before an
 * account is deleted: no charge may outlive the account. Throws if any provider refuses,
 * so the account is kept and the person can retry.
 */
export async function cancelAllSubscriptions(userId: string): Promise<void> {
  const rows = await db
    .select({ id: subscriptions.id, provider: subscriptions.provider, providerSubscriptionId: subscriptions.providerSubscriptionId })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), inArray(subscriptions.status, BILLABLE)))
    .limit(50);

  for (const row of rows) {
    const id = row.providerSubscriptionId;
    if (!id || row.provider === "dev") continue;
    try {
      if (row.provider === "stripe") {
        if (!stripe) throw new Error("Stripe is not configured");
        await stripe.subscriptions.cancel(id);
      } else if (row.provider === "razorpay") {
        if (!razorpay) throw new Error("Razorpay is not configured");
        await razorpay.subscriptions.cancel(id, false);
      }
    } catch (error) {
      // Already cancelled or ended at the provider: nothing left to charge
      if (!(await providerStillBills(row.provider, id))) continue;
      console.error("[billing] cancel before account deletion failed", error);
      throw new MutationError("conflict", "We couldn't cancel your subscription with the payment provider. Nothing was deleted. Try again shortly.");
    }
  }
}

async function providerStillBills(provider: string, id: string): Promise<boolean> {
  try {
    if (provider === "stripe" && stripe) {
      const sub = await stripe.subscriptions.retrieve(id);
      return !["canceled", "incomplete_expired"].includes(sub.status);
    }
    if (provider === "razorpay" && razorpay) {
      const sub = await razorpay.subscriptions.fetch(id);
      return !["cancelled", "completed", "expired"].includes(sub.status);
    }
  } catch {
    // Unknown state: treat as billable so deletion stops
  }
  return true;
}

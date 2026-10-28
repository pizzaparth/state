import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { provisionAccount } from "@/lib/accounts/provision";
import type { PlanId, Provider } from "./plans";

export type SubscriptionStatus = "incomplete" | "active" | "past_due" | "canceled" | "expired";

export interface SubscriptionSnapshot {
  userId: string;
  provider: Provider;
  providerSubscriptionId: string;
  providerCustomerId?: string | null;
  plan: PlanId;
  status: SubscriptionStatus;
  seats?: number;
  cancelAtPeriodEnd?: boolean;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
}

export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete_expired":
      return "expired";
    default:
      return "incomplete";
  }
}

export function mapRazorpayStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "pending":
    case "halted":
      return "past_due";
    case "cancelled":
      return "canceled";
    case "completed":
    case "expired":
      return "expired";
    default:
      // created / authenticated: mandate set up, first charge not yet captured
      return "incomplete";
  }
}

/**
 * Upserts the local subscription row from a verified provider event, mirrors the status
 * onto the user, and provisions the personal workspace on first activation.
 */
export async function syncSubscription(snapshot: SubscriptionSnapshot): Promise<void> {
  const values = {
    userId: snapshot.userId,
    provider: snapshot.provider,
    providerSubscriptionId: snapshot.providerSubscriptionId,
    providerCustomerId: snapshot.providerCustomerId ?? null,
    plan: snapshot.plan,
    status: snapshot.status,
    seats: snapshot.seats ?? 1,
    cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd ?? false,
    currentPeriodStart: snapshot.currentPeriodStart ?? null,
    currentPeriodEnd: snapshot.currentPeriodEnd ?? null,
  };

  await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({ target: subscriptions.providerSubscriptionId, set: values });

  await db
    .update(users)
    .set({ subscriptionStatus: snapshot.status, subscriptionPlan: snapshot.plan })
    .where(eq(users.id, snapshot.userId));

  if (snapshot.status === "active") {
    await provisionAccount(snapshot.userId);
  }
}

export function fromUnixSeconds(value: number | null | undefined): Date | null {
  return value ? new Date(value * 1000) : null;
}

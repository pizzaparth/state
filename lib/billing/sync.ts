import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { payments, subscriptions, users } from "@/db/schema";
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
    currentPeriodStart: snapshot.currentPeriodStart ?? null,
    currentPeriodEnd: snapshot.currentPeriodEnd ?? null,
  };
  // Razorpay's subscription entity does not say whether a cancellation is scheduled, so
  // its events leave the flag as set by lib/billing/manage.ts; Stripe always reports it
  const cancel = snapshot.cancelAtPeriodEnd === undefined ? {} : { cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd };

  // The grace period runs from the first past_due event; later deliveries keep that start
  const pastDueSince =
    snapshot.status === "past_due" ? sql`coalesce(${subscriptions.pastDueSince}, now())` : null;
  await db
    .insert(subscriptions)
    .values({ ...values, cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd ?? false, pastDueSince: snapshot.status === "past_due" ? new Date() : null })
    .onConflictDoUpdate({ target: subscriptions.providerSubscriptionId, set: { ...values, ...cancel, pastDueSince } });

  await db
    .update(users)
    .set({ subscriptionStatus: snapshot.status, subscriptionPlan: snapshot.plan })
    .where(eq(users.id, snapshot.userId));

  if (snapshot.status === "active") {
    await provisionAccount(snapshot.userId);
  }
}

export interface PaymentSnapshot {
  provider: Provider;
  providerSubscriptionId: string;
  providerPaymentId: string;
  amount: number;
  currency: string;
  status: "paid" | "failed";
  periodStart?: Date | null;
  periodEnd?: Date | null;
  receiptUrl?: string | null;
  chargedAt: Date;
}

/**
 * Records one recurring charge against the local subscription it belongs to. Returns
 * false when that subscription is not known yet (the caller syncs it and retries).
 * Idempotent on the provider payment id; a later delivery (failed, then paid on retry)
 * updates the row.
 */
export async function recordPayment(payment: PaymentSnapshot): Promise<boolean> {
  const [sub] = await db
    .select({ id: subscriptions.id, userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.providerSubscriptionId, payment.providerSubscriptionId))
    .limit(1);
  if (!sub) return false;
  const values = {
    userId: sub.userId,
    subscriptionId: sub.id,
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    amount: payment.amount,
    currency: payment.currency.toUpperCase(),
    status: payment.status,
    periodStart: payment.periodStart ?? null,
    periodEnd: payment.periodEnd ?? null,
    receiptUrl: payment.receiptUrl ?? null,
    chargedAt: payment.chargedAt,
  };
  await db.insert(payments).values(values).onConflictDoUpdate({ target: payments.providerPaymentId, set: values });
  return true;
}

export function fromUnixSeconds(value: number | null | undefined): Date | null {
  return value ? new Date(value * 1000) : null;
}

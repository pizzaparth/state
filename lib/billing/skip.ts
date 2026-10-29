import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { provisionAccount } from "@/lib/accounts/provision";
import type { PlanId } from "./plans";

const isLocalUrl = (value: string | undefined) => {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(value ?? "").hostname);
  } catch {
    return false;
  }
};

/**
 * "Skip payment" exists for local development and test runs only. It is on in
 * `next dev`, or in a production build when ALLOW_PAYMENT_SKIP=1 and the app runs on a
 * localhost URL. lib/env.ts refuses to start a public deployment with the flag set.
 */
export function paymentSkipEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  return env.ALLOW_PAYMENT_SKIP === "1" && isLocalUrl(env.BETTER_AUTH_URL);
}

/**
 * Grants a 30-day development subscription and provisions the workspace, exactly as a
 * first successful payment would. Idempotent: one row per user (provider "dev").
 */
export async function grantDevSubscription(userId: string, plan: PlanId): Promise<void> {
  const now = new Date();
  const values = {
    userId,
    provider: "dev",
    providerSubscriptionId: `dev-${userId}`,
    plan,
    status: "active",
    seats: 1,
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
  };
  await db.insert(subscriptions).values(values).onConflictDoUpdate({ target: subscriptions.providerSubscriptionId, set: values });
  await db.update(users).set({ subscriptionStatus: "active", subscriptionPlan: plan }).where(eq(users.id, userId));
  await provisionAccount(userId);
}

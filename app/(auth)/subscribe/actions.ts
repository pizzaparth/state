"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { grantDevSubscription, paymentSkipEnabled } from "@/lib/billing/skip";

const skipSchema = z.strictObject({ plan: z.enum(["individual", "organisation"]) });

/** Development only: activates the account without a payment provider. */
export async function skipPaymentAction(input: unknown): Promise<{ error: string } | never> {
  // Checked on the server on every call; hiding the button is not the protection
  if (!paymentSkipEnabled()) return { error: "Payment is required." };
  const session = await getSession();
  if (!session) return { error: "Your session has ended. Sign in again." };
  const parsed = skipSchema.safeParse(input);
  if (!parsed.success) return { error: "Choose a plan." };
  await grantDevSubscription(session.user.id, parsed.data.plan);
  redirect("/platform/today");
}

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { syncSubscription } from "@/lib/billing/sync";
import { razorpayVerifySchema } from "@/lib/validation";
import type { PlanId } from "@/lib/billing/plans";

// Called by Razorpay Checkout's success handler. Grants access immediately after a
// signature check; the webhook remains the source of truth for later state changes.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Razorpay is not configured." }, { status: 503 });
  }

  const parsed = razorpayVerifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment confirmation." }, { status: 400 });
  }
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = parsed.data;

  const expected = Buffer.from(
    crypto.createHmac("sha256", secret).update(`${razorpay_payment_id}|${razorpay_subscription_id}`).digest("hex"),
    "utf8"
  );
  const received = Buffer.from(razorpay_signature, "utf8");
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return NextResponse.json({ error: "Payment signature did not match." }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.providerSubscriptionId, razorpay_subscription_id), eq(subscriptions.userId, session.user.id)))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Subscription not found for this account." }, { status: 404 });
  }

  await syncSubscription({
    userId: row.userId,
    provider: "razorpay",
    providerSubscriptionId: razorpay_subscription_id,
    providerCustomerId: row.providerCustomerId,
    plan: row.plan as PlanId,
    status: "active",
    seats: row.seats,
  });

  return NextResponse.json({ ok: true });
}

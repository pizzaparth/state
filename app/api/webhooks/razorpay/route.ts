import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { mapRazorpayStatus, recordPayment, syncSubscription, fromUnixSeconds } from "@/lib/billing/sync";

const subscriptionEventSchema = z.object({
  event: z.string(),
  payload: z.object({
    subscription: z
      .object({
        entity: z.object({
          id: z.string(),
          status: z.string(),
          customer_id: z.string().nullable().optional(),
          quantity: z.number().int().optional(),
          current_start: z.number().nullable().optional(),
          current_end: z.number().nullable().optional(),
          notes: z
            .union([z.object({ userId: z.string().optional(), plan: z.enum(["individual", "organisation"]).optional() }), z.array(z.unknown())])
            .optional(),
        }),
      })
      .optional(),
    // subscription.charged carries the payment that renewed the subscription
    payment: z
      .object({
        entity: z.object({
          id: z.string(),
          amount: z.number().int(),
          currency: z.string(),
          created_at: z.number(),
        }),
      })
      .optional(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret || !signature) {
      return NextResponse.json({ error: "Missing webhook secret or signature" }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    // Constant-time comparison to avoid leaking signature bytes via timing
    const expected = Buffer.from(expectedSignature, "utf8");
    const received = Buffer.from(signature, "utf8");
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const parsed = subscriptionEventSchema.safeParse(JSON.parse(rawBody));
    const entity = parsed.success ? parsed.data.payload.subscription?.entity : undefined;
    const payment = parsed.success ? parsed.data.payload.payment?.entity : undefined;
    // Only subscription.* events carry a subscription entity; acknowledge everything else
    if (!entity) {
      return NextResponse.json({ received: true });
    }

    // Razorpay sends notes as [] when empty
    const notes = Array.isArray(entity.notes) ? {} : entity.notes ?? {};
    if (notes.userId && notes.plan) {
      await syncSubscription({
        userId: notes.userId,
        provider: "razorpay",
        providerSubscriptionId: entity.id,
        providerCustomerId: entity.customer_id ?? null,
        plan: notes.plan,
        status: mapRazorpayStatus(entity.status),
        seats: entity.quantity ?? 1,
        currentPeriodStart: fromUnixSeconds(entity.current_start),
        currentPeriodEnd: fromUnixSeconds(entity.current_end),
      });
    }

    // Every successful recurring charge (first and renewals) lands in the payments ledger
    if (parsed.success && parsed.data.event === "subscription.charged" && payment) {
      await recordPayment({
        provider: "razorpay",
        providerSubscriptionId: entity.id,
        providerPaymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: "paid",
        periodStart: fromUnixSeconds(entity.current_start),
        periodEnd: fromUnixSeconds(entity.current_end),
        chargedAt: new Date(payment.created_at * 1000),
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("razorpay webhook failed", err);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}

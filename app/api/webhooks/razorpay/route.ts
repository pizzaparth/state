import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { mapRazorpayStatus, syncSubscription, fromUnixSeconds } from "@/lib/billing/sync";

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

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("razorpay webhook failed", err);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/billing";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe || !secret || !signature) {
      return NextResponse.json({ error: "Missing stripe configuration or signature" }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

    // Process stripe subscription events (customer.subscription.updated, customer.subscription.deleted)
    switch (event.type) {
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe webhook error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/billing";
import { mapStripeStatus, syncSubscription, fromUnixSeconds } from "@/lib/billing/sync";
import { PLAN_IDS, type PlanId } from "@/lib/billing/plans";

async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  const plan = subscription.metadata.plan as PlanId;
  if (!userId || !PLAN_IDS.includes(plan)) return;

  await syncSubscription({
    userId,
    provider: "stripe",
    providerSubscriptionId: subscription.id,
    providerCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    plan,
    status: mapStripeStatus(subscription.status),
    seats: subscription.items.data[0]?.quantity ?? 1,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodStart: fromUnixSeconds(subscription.current_period_start),
    currentPeriodEnd: fromUnixSeconds(subscription.current_period_end),
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe || !secret || !signature) {
      return NextResponse.json({ error: "Missing stripe configuration or signature" }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

    switch (event.type) {
      case "checkout.session.completed": {
        const subscriptionId = event.data.object.subscription;
        if (typeof subscriptionId === "string") {
          await syncStripeSubscription(await stripe.subscriptions.retrieve(subscriptionId));
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncStripeSubscription(event.data.object);
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("stripe webhook rejected", err);
    return NextResponse.json({ error: "Webhook rejected." }, { status: 400 });
  }
}

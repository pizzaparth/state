import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/billing";
import { mapStripeStatus, recordPayment, syncSubscription, fromUnixSeconds } from "@/lib/billing/sync";
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

/**
 * Records a subscription invoice (first charge and every renewal). The invoice can arrive
 * before the subscription's own event, so an unknown subscription is synced first.
 */
async function recordStripeInvoice(invoice: Stripe.Invoice, status: "paid" | "failed") {
  if (!stripe) return;
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!subscriptionId || !invoice.id) return;
  const line = invoice.lines.data[0];
  const payment = {
    provider: "stripe" as const,
    providerSubscriptionId: subscriptionId,
    providerPaymentId: invoice.id,
    amount: status === "paid" ? invoice.amount_paid : invoice.amount_due,
    currency: invoice.currency,
    status,
    periodStart: fromUnixSeconds(line?.period.start),
    periodEnd: fromUnixSeconds(line?.period.end),
    receiptUrl: invoice.hosted_invoice_url ?? null,
    chargedAt: new Date((invoice.status_transitions.paid_at ?? invoice.created) * 1000),
  };
  if (await recordPayment(payment)) return;
  await syncStripeSubscription(await stripe.subscriptions.retrieve(subscriptionId));
  await recordPayment(payment);
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
      case "invoice.paid":
        await recordStripeInvoice(event.data.object, "paid");
        break;
      case "invoice.payment_failed":
        await recordStripeInvoice(event.data.object, "failed");
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

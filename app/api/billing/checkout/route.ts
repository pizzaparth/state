import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { razorpay, stripe } from "@/lib/billing";
import { providerForCountry, providerPlanId } from "@/lib/billing/plans";
import { syncSubscription } from "@/lib/billing/sync";
import { hasPaidAccess } from "@/lib/billing/access";
import { checkoutSchema } from "@/lib/validation";
import { readJsonBody, rejectCrossOrigin } from "@/lib/security/request";
import { consumeThrottle } from "@/lib/security/throttle";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(req: NextRequest) {
  const crossOrigin = rejectCrossOrigin(req);
  if (crossOrigin) return crossOrigin;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to subscribe." }, { status: 401 });
  }

  const body = await readJsonBody(req);
  if (!body.ok) return body.response;
  const parsed = checkoutSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan selection.", issues: z.flattenError(parsed.error) }, { status: 400 });
  }
  const { plan, interval, seats } = parsed.data;
  const { user } = session;

  // Each attempt creates a provider-side subscription or session; cap them per account
  if (!(await consumeThrottle(`checkout:${user.id}`, 10, 60 * 60))) {
    return NextResponse.json({ error: "Too many checkout attempts. Try again in an hour." }, { status: 429 });
  }

  if (await hasPaidAccess(user.id)) {
    return NextResponse.json({ error: "You already have an active subscription." }, { status: 409 });
  }

  const provider = providerForCountry(req.headers.get("x-vercel-ip-country"));
  const planId = providerPlanId(provider, plan, interval);
  if (!planId) {
    return NextResponse.json({ error: `Billing is not configured for ${plan} ${interval}.` }, { status: 503 });
  }

  try {
    if (provider === "razorpay") {
      if (!razorpay || !process.env.RAZORPAY_KEY_ID) {
        return NextResponse.json({ error: "Razorpay is not configured." }, { status: 503 });
      }
      const subscription = await razorpay.subscriptions.create({
        plan_id: planId,
        total_count: interval === "monthly" ? 120 : 10,
        quantity: seats,
        customer_notify: 1,
        notes: { userId: user.id, plan },
      });
      // Record locally as incomplete so webhooks and verification can find the owner
      await syncSubscription({
        userId: user.id,
        provider,
        providerSubscriptionId: subscription.id,
        plan,
        status: "incomplete",
        seats,
      });
      return NextResponse.json({
        provider,
        keyId: process.env.RAZORPAY_KEY_ID,
        subscriptionId: subscription.id,
        prefill: { name: user.name, email: user.email },
      });
    }

    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
    }
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: planId, quantity: seats }],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { userId: user.id, plan },
      subscription_data: { metadata: { userId: user.id, plan } },
      success_url: `${appUrl()}/subscribe/complete`,
      cancel_url: `${appUrl()}/subscribe?canceled=1`,
    });
    return NextResponse.json({ provider, url: checkout.url });
  } catch (err) {
    // Provider errors can include account details; log them, return a generic message
    console.error("checkout failed", err);
    return NextResponse.json({ error: "Could not start checkout. Try again shortly." }, { status: 502 });
  }
}

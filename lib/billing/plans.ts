/**
 * State subscription plans. Paid-only: no free tier, no trial (docs/state_desc.md §39).
 * Displayed INR prices live here; provider plan/price IDs come from env so the amount
 * charged is always the one configured in Razorpay/Stripe.
 */

export const PLAN_IDS = ["individual", "organisation"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const INTERVALS = ["monthly", "yearly"] as const;
export type Interval = (typeof INTERVALS)[number];

export type Provider = "razorpay" | "stripe";

export interface Plan {
  id: PlanId;
  name: string;
  summary: string;
  perSeat: boolean;
  priceInr: Record<Interval, number>;
  includes: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  individual: {
    id: "individual",
    name: "Individual",
    summary: "For one person measuring their own execution.",
    perSeat: false,
    priceInr: { monthly: 199, yearly: 1990 },
    includes: [
      "Personal workspace and board",
      "Unlimited tasks, projects and commits",
      "Execution graph, history and metrics",
      "Recurring tasks and objectives",
      "CSV and JSON export",
    ],
  },
  organisation: {
    id: "organisation",
    name: "Organisation",
    summary: "For teams that ship together. Billed per member.",
    perSeat: true,
    priceInr: { monthly: 299, yearly: 2990 },
    includes: [
      "Everything in Individual",
      "Organisation boards and shared projects",
      "Members, roles and task assignment",
      "Organisation history, graph and metrics",
    ],
  },
};

const ENV_KEYS: Record<Provider, Record<PlanId, Record<Interval, string>>> = {
  razorpay: {
    individual: { monthly: "RAZORPAY_PLAN_INDIVIDUAL_MONTHLY", yearly: "RAZORPAY_PLAN_INDIVIDUAL_YEARLY" },
    organisation: { monthly: "RAZORPAY_PLAN_ORGANISATION_MONTHLY", yearly: "RAZORPAY_PLAN_ORGANISATION_YEARLY" },
  },
  stripe: {
    individual: { monthly: "STRIPE_PRICE_INDIVIDUAL_MONTHLY", yearly: "STRIPE_PRICE_INDIVIDUAL_YEARLY" },
    organisation: { monthly: "STRIPE_PRICE_ORGANISATION_MONTHLY", yearly: "STRIPE_PRICE_ORGANISATION_YEARLY" },
  },
};

/** Name of the env var holding the provider plan/price ID for this combination. */
export function providerPlanEnvKey(provider: Provider, plan: PlanId, interval: Interval): string {
  return ENV_KEYS[provider][plan][interval];
}

/** Provider-side plan (Razorpay) or price (Stripe) ID, or null when not configured. */
export function providerPlanId(provider: Provider, plan: PlanId, interval: Interval): string | null {
  return process.env[ENV_KEYS[provider][plan][interval]] || null;
}

/** India pays through Razorpay; everywhere else through Stripe. */
export function providerForCountry(country: string | null): Provider {
  return !country || country === "IN" ? "razorpay" : "stripe";
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

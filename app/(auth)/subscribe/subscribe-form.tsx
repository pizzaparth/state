"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatInr, type Interval, type Plan, type PlanId } from "@/lib/billing/plans";
import { skipPaymentAction } from "./actions";

interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
    document.body.appendChild(script);
  });
}

const optionClasses =
  "flex cursor-pointer items-start gap-3 rounded-input border px-4 py-3 transition-[border-color,background-color] has-[:checked]:border-white/40 has-[:checked]:bg-white/[0.04] border-white/[0.1] hover:border-white/20 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-white/80";

export function SubscribeForm({
  plans,
  initialPlan,
  initialInterval,
  canSkip = false,
}: {
  plans: Plan[];
  initialPlan: PlanId;
  initialInterval: Interval;
  /** Development builds only (lib/billing/skip.ts); the server re-checks on every call. */
  canSkip?: boolean;
}) {
  const router = useRouter();
  const [planId, setPlanId] = React.useState<PlanId>(initialPlan);
  const [interval, setInterval] = React.useState<Interval>(initialInterval);
  const [seats, setSeats] = React.useState("2");
  const [pending, setPending] = React.useState(false);
  const [skipping, startSkip] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const plan = plans.find((p) => p.id === planId)!;
  const seatCount = plan.perSeat ? Math.max(1, Number.parseInt(seats, 10) || 1) : 1;
  const total = plan.priceInr[interval] * seatCount;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: planId, interval, seats: seatCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout.");

      if (data.provider === "stripe") {
        window.location.assign(data.url);
        return;
      }

      await loadRazorpay();
      const checkout = new window.Razorpay!({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "State",
        description: `${plan.name} · ${interval}`,
        prefill: data.prefill,
        theme: { color: "#0A0A0A" },
        handler: async (response: RazorpayCheckoutResponse) => {
          const verify = await fetch("/api/billing/razorpay/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(response),
          });
          if (verify.ok) {
            router.replace("/platform/today");
          } else {
            router.replace("/subscribe/complete");
          }
        },
        modal: { ondismiss: () => setPending(false) },
      });
      checkout.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-[#A9A9A6]">Plan</legend>
        {plans.map((p) => (
          <label key={p.id} className={optionClasses}>
            <input
              type="radio"
              name="plan"
              value={p.id}
              checked={planId === p.id}
              onChange={() => {
                setPlanId(p.id);
                setError(null);
              }}
              className="mt-1 accent-white"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-[#F4F4F2]">{p.name}</span>
                <span className="text-sm tabular-nums text-[#F4F4F2]">
                  {formatInr(p.priceInr[interval])}
                  <span className="text-xs text-[#6F6F6B]">
                    {p.perSeat ? " / member" : ""} / {interval === "monthly" ? "month" : "year"}
                  </span>
                </span>
              </span>
              <span className="block text-xs text-[#A9A9A6]">{p.summary}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-[#A9A9A6]">Billing</legend>
        <div className="grid grid-cols-2 gap-1 rounded-input border border-white/[0.1] p-1">
          {(["monthly", "yearly"] as const).map((value) => (
            <label
              key={value}
              className={cn(
                "flex h-9 cursor-pointer items-center justify-center rounded-control text-xs transition-[background-color,color]",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-white/80",
                interval === value ? "bg-[#F1F1EE] text-[#090909] font-semibold" : "text-[#A9A9A6] hover:text-white"
              )}
            >
              <input
                type="radio"
                name="interval"
                value={value}
                checked={interval === value}
                onChange={() => {
                  setInterval(value);
                  setError(null);
                }}
                className="sr-only"
              />
              {value === "monthly" ? "Monthly" : "Yearly · 2 months free"}
            </label>
          ))}
        </div>
      </fieldset>

      {plan.perSeat && (
        <div className="space-y-1">
          <label htmlFor="seats" className="block text-sm font-medium text-[#A9A9A6]">
            Members
          </label>
          <input
            id="seats"
            name="seats"
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            value={seats}
            onChange={(e) => {
              setSeats(e.target.value);
              setError(null);
            }}
            className="w-full h-11 px-4 text-sm tabular-nums bg-[#151515] text-[#F4F4F2] rounded-input border border-white/[0.1] focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 transition-[border-color,box-shadow] touch-manipulation"
          />
        </div>
      )}

      <div className="flex items-baseline justify-between border-t border-white/[0.08] pt-4 text-sm">
        <span className="text-[#A9A9A6]">Due today</span>
        <span className="text-lg font-semibold tabular-nums text-[#F4F4F2]">{formatInr(total)}</span>
      </div>

      <p aria-live="polite" className="min-h-4 text-sm text-[#E5A3A3]">
        {error}
      </p>

      <Button type="submit" variant="dark-cta" size="md" className="w-full" isLoading={pending} disabled={pending}>
        Continue to payment
      </Button>
      <p className="text-center text-[11px] text-[#6F6F6B]">
        Payments in India via Razorpay; elsewhere via Stripe. Prices in INR; Stripe charges the local equivalent.
      </p>
      {canSkip && (
        <div className="space-y-2 border-t border-dashed border-white/[0.12] pt-4">
          <Button
            type="button"
            variant="dark-secondary"
            size="md"
            className="w-full"
            isLoading={skipping}
            disabled={skipping || pending}
            onClick={() =>
              startSkip(async () => {
                const result = await skipPaymentAction({ plan: planId });
                if (result?.error) setError(result.error);
              })
            }
          >
            Skip payment
          </Button>
          <p className="text-center text-[11px] text-[#6F6F6B]">
            Development only. Activates a 30-day {plan.name.toLowerCase()} subscription without charging. Not available in production.
          </p>
        </div>
      )}
    </form>
  );
}

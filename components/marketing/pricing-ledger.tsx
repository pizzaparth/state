"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLANS, formatInr, type Interval } from "@/lib/billing/plans";

/**
 * Two plans set as type, separated by a rule. No free column and no trial: the CTA
 * creates an account and goes straight to payment.
 */
export function PricingLedger() {
  const [interval, setInterval] = React.useState<Interval>("monthly");

  return (
    <div>
      <div role="radiogroup" aria-label="Billing interval" className="inline-flex rounded-full border border-white/[0.12] p-1">
        {(["monthly", "yearly"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={interval === value}
            onClick={() => setInterval(value)}
            className={cn(
              "h-9 rounded-full px-4 text-sm transition-[background-color,color]",
              interval === value ? "bg-[#F1F1EE] font-semibold text-[#090909]" : "text-[#A9A9A6] hover:text-white"
            )}
          >
            {value === "monthly" ? "Monthly" : "Yearly, 2 months free"}
          </button>
        ))}
      </div>

      <div className="mt-12 grid md:grid-cols-2">
        {Object.values(PLANS).map((plan, i) => (
          <div
            key={plan.id}
            className={cn(
              "flex flex-col py-8 md:py-0",
              i === 0 ? "md:pr-12" : "border-t border-white/[0.08] md:border-l md:border-t-0 md:pl-12"
            )}
          >
            <h3 className="text-lg font-semibold text-[#F4F4F2]">{plan.name}</h3>
            <p className="mt-1 text-sm text-[#A9A9A6]">{plan.summary}</p>
            <p className="mt-8 flex items-baseline gap-2">
              <span className="font-display text-[clamp(3.5rem,8vw,6.5rem)] font-extrabold leading-none tabular-nums tracking-[-0.03em] [font-stretch:115%] text-[#F4F4F2]">
                {formatInr(plan.priceInr[interval])}
              </span>
              <span className="text-sm text-[#6F6F6B]">
                {plan.perSeat ? "per member, " : ""}
                {interval === "monthly" ? "per month" : "per year"}
              </span>
            </p>
            <ul className="mt-8 space-y-2 text-sm text-[#A9A9A6]">
              {plan.includes.map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-[#6F6F6B]" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <Button asChild variant={i === 0 ? "dark-cta" : "dark-secondary"} size="lg">
                <Link href={`/register?plan=${plan.id}&interval=${interval}`}>Subscribe to {plan.name}</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-12 max-w-[60ch] text-sm text-[#6F6F6B]">
        Payment is taken at sign-up; there is no free plan or trial. Cancel whenever you like, and export every task and commit
        as CSV or JSON before you go.
      </p>
    </div>
  );
}

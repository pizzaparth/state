import type { Metadata } from "next";
import { PricingLedger } from "@/components/marketing/pricing-ledger";

export const metadata: Metadata = {
  title: "Pricing",
  description: "State pricing: Individual and Organisation plans for a to-do list and kanban app with real work metrics. No ads, no free tier.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <section className="mx-auto w-full max-w-[1320px] px-5 pb-[16vh] pt-40 sm:px-8 lg:px-12">
      <h1 className="font-display text-[clamp(2.25rem,10vw,8.5rem)] font-extrabold uppercase leading-[0.88] tracking-[-0.03em] [font-stretch:125%] bg-gradient-to-b from-white via-[#D9D9D5] to-[#6F6F6B] bg-clip-text text-transparent">
        Pricing
      </h1>
      <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[#A9A9A6]">
        Two plans, no free tier, no trial, no ads. You pay when you sign up and your workspace opens straight after.
      </p>
      <div className="mt-16">
        <PricingLedger />
      </div>
    </section>
  );
}

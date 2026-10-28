import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default function PricingPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20 md:py-28 space-y-16">
      <div className="text-center space-y-4 max-w-xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#F4F4F2] uppercase">
          Subscription
        </h1>
        <p className="text-[#A9A9A6] text-sm md:text-base">
          State has no ads and no free plan. Subscription revenue aligns our incentives directly with your execution.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Individual Plan */}
        <div className="p-8 rounded-card bg-white/[0.03] border border-white/[0.1] space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-xs font-mono uppercase tracking-widest text-[#A9A9A6]">
              Personal
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold text-[#F4F4F2] font-mono tabular-nums">
                ₹199
              </span>
              <span className="text-xs text-[#A9A9A6]">/ month</span>
            </div>
            <p className="text-xs text-[#A9A9A6]">
              For developers, researchers, founders, and engineers measuring personal output.
            </p>

            <ul className="space-y-3 pt-4 text-xs text-[#A9A9A6]">
              <li className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-[#F4F4F2]" />
                <span>Unlimited tasks, projects & commits</span>
              </li>
              <li className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-[#F4F4F2]" />
                <span>Horizontal execution graph & history ledger</span>
              </li>
              <li className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-[#F4F4F2]" />
                <span>Velocity, throughput & cycle time analysis</span>
              </li>
              <li className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-[#F4F4F2]" />
                <span>Today work surface & quick capture</span>
              </li>
            </ul>
          </div>

          <div className="pt-6">
            <Button asChild variant="dark-cta" size="md" className="w-full">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>

        {/* Organisation Plan */}
        <div className="p-8 rounded-card bg-white/[0.05] border border-white/[0.2] space-y-6 flex flex-col justify-between shadow-dark-card">
          <div className="space-y-4">
            <span className="text-xs font-mono uppercase tracking-widest text-[#F4F4F2]">
              Organisation
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold text-[#F4F4F2] font-mono tabular-nums">
                ₹299
              </span>
              <span className="text-xs text-[#A9A9A6]">/ member / month</span>
            </div>
            <p className="text-xs text-[#A9A9A6]">
              For research groups, technical startups, and engineering teams.
            </p>

            <ul className="space-y-3 pt-4 text-xs text-[#A9A9A6]">
              <li className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-[#F4F4F2]" />
                <span>Everything in Personal</span>
              </li>
              <li className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-[#F4F4F2]" />
                <span>Shared team boards & project execution tracking</span>
              </li>
              <li className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-[#F4F4F2]" />
                <span>Team throughput & project velocity metrics</span>
              </li>
              <li className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 text-[#F4F4F2]" />
                <span>Role-based access & organisation workspaces</span>
              </li>
            </ul>
          </div>

          <div className="pt-6">
            <Button asChild variant="dark-cta" size="md" className="w-full">
              <Link href="/register">Start Team Trial</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

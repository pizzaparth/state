import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { Magnetic, MagneticLabel } from "@/components/marketing/magnetic";
import { ExecutionMatrix } from "@/components/marketing/execution-matrix";
import { WorkspaceScope } from "@/components/marketing/workspace-scope";
import { PricingLedger } from "@/components/marketing/pricing-ledger";
import { DEMO_DAYS, formatNumber } from "@/components/marketing/demo-data";
import { PLANS, formatInr } from "@/lib/billing/plans";

const silver = "bg-gradient-to-b from-white via-[#D9D9D5] to-[#6F6F6B] bg-clip-text text-transparent";
const displayHeading =
  "font-display font-extrabold uppercase leading-[0.92] tracking-[-0.03em] text-balance";
const sectionPad = "mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12";

// Worked metric examples, computed from the same seeded history the graph shows
const last30 = DEMO_DAYS.slice(-30);
const execution = last30.reduce((s, d) => s + d.execution, 0);
const tasks = last30.reduce((s, d) => s + d.tasks, 0);
const planned = tasks + 31;
const activeDays = last30.filter((d) => d.commits > 0).length;

const METRICS = [
  {
    name: "Execution",
    value: formatNumber(execution),
    formula: "Σ completed task weights + manual commit weights",
    worked: "Small 1, normal 2, major 4, milestone 8",
  },
  {
    name: "Velocity",
    value: `${formatNumber(execution / 30, 2)}/day`,
    formula: "Execution ÷ days in period",
    worked: `${execution} ÷ 30`,
  },
  {
    name: "Throughput",
    value: `${formatNumber(tasks / 30, 2)}/day`,
    formula: "Completed tasks ÷ days in period",
    worked: `${tasks} ÷ 30`,
  },
  {
    name: "Completion",
    value: `${formatNumber((tasks / planned) * 100, 1)}%`,
    formula: "Completed planned tasks ÷ planned tasks",
    worked: `${tasks} ÷ ${planned}`,
  },
  {
    name: "Cycle time",
    value: "1.8d",
    formula: "Median of completed_at − started_at",
    worked: `Median of ${tasks} durations`,
  },
  {
    name: "Consistency",
    value: `${formatNumber((activeDays / 30) * 100)}%`,
    formula: "Days with at least one commit ÷ eligible days",
    worked: `${activeDays} ÷ 30`,
  },
];

const REFUSALS = [
  "Advertising",
  "AI summaries and chat sidebars",
  "Badges, XP and streak pressure",
  "Keystroke and hours-online tracking",
  "Team leaderboards",
  "An unexplained productivity score",
];


export default function LandingPage() {
  return (
    <>
      {/* Hero: type is the graphic; the particle field sits behind */}
      <section className={`${sectionPad} relative flex min-h-[100svh] flex-col justify-end pb-[10vh] pt-32`}>
        <LogoMark className="absolute right-5 top-28 size-32 animate-fade-in text-[#F4F4F2] [animation-delay:300ms] sm:right-8 md:size-48 lg:right-12 lg:size-60" />
        <h1 className={`${displayHeading} ${silver} text-[clamp(2.25rem,10vw,9.5rem)] leading-[0.86]`}>
          <span className="block overflow-hidden pb-[0.04em]">
            <span className="block animate-line-rise">Execution,</span>
          </span>
          <span className="block overflow-hidden pb-[0.06em]">
            <span className="block animate-line-rise [animation-delay:120ms]">measured.</span>
          </span>
        </h1>

        <div className="mt-10 animate-fade-in [animation-delay:500ms]">
          <div>
            <p className="max-w-[44ch] text-lg leading-relaxed text-[#A9A9A6] text-pretty sm:text-xl">
              Tasks are what you intend. Commits are what you actually did. State keeps both and measures the
              difference, day after day.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Magnetic>
                <Button asChild variant="dark-cta" size="lg" className="rounded-full px-7">
                  <Link href="/register">
                    <MagneticLabel>Subscribe</MagneticLabel>
                  </Link>
                </Button>
              </Magnetic>
              <Button asChild variant="dark-secondary" size="lg" className="rounded-full px-7">
                <Link href="#history">See your history</Link>
              </Button>
            </div>
          </div>

        </div>
      </section>

      {/* History */}
      <section id="history" aria-labelledby="history-title" className={`${sectionPad} scroll-mt-16 py-[16vh]`}>
        <div className="max-w-3xl">
          <h2 id="history-title" className={`${displayHeading} text-[clamp(1.375rem,5.6vw,4.75rem)]`}>
            Your work has a history.
          </h2>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[#A9A9A6]">
            Every completed task becomes a commit, and every commit lands on one day of the graph. Hover a day, or focus the
            graph and use the arrow keys.
          </p>
        </div>
        <div className="mt-16">
          <ExecutionMatrix />
        </div>
      </section>

      {/* Metrics */}
      <section aria-labelledby="metrics-title" className={`${sectionPad} py-[16vh]`}>
        <h2 id="metrics-title" className={`${displayHeading} text-[clamp(1.375rem,5.6vw,4.75rem)]`}>
          Measure throughput, not busyness.
        </h2>
        <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[#A9A9A6]">
          Six numbers, each with its formula beside it. No score to take on trust. Worked here for the last 30 days of the
          graph above.
        </p>

        <table className="mt-16 w-full border-collapse text-left">
          <caption className="sr-only">State metrics with their formulas, last 30 days</caption>
          <thead className="max-md:sr-only">
            <tr className="text-sm text-[#6F6F6B]">
              <th scope="col" className="pb-3 font-normal">Metric</th>
              <th scope="col" className="pb-3 pr-12 text-right font-normal">Value</th>
              <th scope="col" className="pb-3 font-normal">Formula</th>
              <th scope="col" className="pb-3 font-normal">Worked</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric) => (
              <tr
                key={metric.name}
                className="group border-t border-white/[0.08] transition-colors hover:border-white/25 max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-4 max-md:py-4"
              >
                <th scope="row" className="py-5 text-base font-medium text-[#F4F4F2] max-md:py-0">
                  {metric.name}
                </th>
                <td className="py-5 pr-12 text-right font-display text-[clamp(1.75rem,3.5vw,3rem)] font-bold leading-none tabular-nums text-[#F4F4F2] max-md:row-span-2 max-md:self-center max-md:py-0 max-md:pr-0">
                  {metric.value}
                </td>
                <td className="py-5 text-base text-[#A9A9A6] max-md:py-0">{metric.formula}</td>
                <td className="py-5 font-mono text-sm tabular-nums text-[#6F6F6B] transition-colors group-hover:text-[#A9A9A6] max-md:col-span-2 max-md:py-0 max-md:pt-1">
                  {metric.worked}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Personal / organisation */}
      <section aria-labelledby="scope-title" className={`${sectionPad} py-[16vh]`}>
        <h2 id="scope-title" className={`${displayHeading} text-[clamp(1.375rem,5.6vw,4.75rem)]`}>
          Personal or organisational.
        </h2>
        <div className="mt-12">
          <WorkspaceScope />
        </div>
      </section>

      {/* Refusals */}
      <section aria-labelledby="refusals-title" className={`${sectionPad} py-[16vh]`}>
        <h2 id="refusals-title" className={`${displayHeading} text-[clamp(1.375rem,5.6vw,4.75rem)]`}>
          No ads. No AI noise.
        </h2>
        <p className="mt-6 text-lg text-[#A9A9A6]">What State will never ship:</p>
        <ul className="mt-10 space-y-1">
          {REFUSALS.map((item) => (
            <li
              key={item}
              className="font-display text-[clamp(1.5rem,4.2vw,3.5rem)] font-bold uppercase leading-[1.1] tracking-[-0.02em] text-[#4A4A47] line-through decoration-[#8B8B86] decoration-2"
            >
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-14 max-w-[40ch] text-xl leading-relaxed text-[#F4F4F2] text-pretty sm:text-2xl">
          State records what needed to happen, what happened, and how consistently you execute. That is the whole product.
        </p>
      </section>

      {/* Pricing */}
      <section id="pricing" aria-labelledby="pricing-title" className={`${sectionPad} scroll-mt-24 py-[16vh]`}>
        <h2 id="pricing-title" className={`${displayHeading} text-[clamp(1.375rem,5.6vw,4.75rem)]`}>
          Paid from day one.
        </h2>
        <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[#A9A9A6]">
          Subscriptions are the only revenue, so the product answers to you and nobody else.
        </p>
        <div className="mt-14">
          <PricingLedger />
        </div>
      </section>

      {/* Closing */}
      <section className={`${sectionPad} flex min-h-[80svh] flex-col justify-center py-[12vh]`}>
        <h2 className={`${displayHeading} ${silver} text-[clamp(2rem,8.5vw,8rem)] leading-[0.88]`}>Start measuring.</h2>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <Magnetic strength={0.45} radius={160}>
            <Button asChild variant="dark-cta" size="lg" className="rounded-full px-8">
              <Link href="/register">
                <MagneticLabel>Subscribe</MagneticLabel>
              </Link>
            </Button>
          </Magnetic>
          <p className="text-base text-[#6F6F6B]">
            From {formatInr(PLANS.individual.priceInr.monthly)} a month. Your workspace opens as soon as payment clears.
          </p>
        </div>
      </section>
    </>
  );
}

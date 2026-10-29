import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Magnetic, MagneticLabel } from "@/components/marketing/magnetic";
import { WorkspaceScope } from "@/components/marketing/workspace-scope";
import { PricingLedger } from "@/components/marketing/pricing-ledger";
import { ProductFrame } from "@/components/marketing/product-frame";
import { ExecutionGraph } from "@/components/app/execution-graph";
import { CommitLedger } from "@/components/app/commit-ledger";
import { MetricsReport } from "@/components/app/metrics-view";
import { Panel } from "@/components/app/primitives";
import { DEMO_TZ, demoBoard, demoCommits, demoDaily, demoMetrics, demoSeries, demoWorkspaces } from "@/lib/demo/workspace";
import { formatNumber } from "@/lib/format";
import { PLANS, formatInr } from "@/lib/billing/plans";

const silver = "bg-gradient-to-b from-white via-[#D9D9D5] to-[#6F6F6B] bg-clip-text text-transparent";
const displayHeading =
  "font-display font-extrabold uppercase leading-[0.92] tracking-[-0.03em] [font-stretch:125%] text-balance";
const sectionPad = "mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12";

// Board cards finished in the last two days stay in Done
const DONE_WINDOW_DAYS = 2;

const REFUSALS = [
  "Advertising",
  "AI summaries and chat sidebars",
  "Badges, XP and streak pressure",
  "Keystroke and hours-online tracking",
  "Team leaderboards",
  "An unexplained productivity score",
];


export default function LandingPage() {
  // The real product screens, fed by a generated demo workspace (lib/demo/workspace.ts)
  const { personal, organisation } = demoWorkspaces();
  const year = demoDaily(personal, 371);
  const yearCommits = year.reduce((n, d) => n + d.commits, 0);
  const yearExecution = year.reduce((n, d) => n + d.execution, 0);
  const boards = {
    personal: demoBoard(personal, "personal", DONE_WINDOW_DAYS),
    organisation: demoBoard(organisation, "organisation", DONE_WINDOW_DAYS),
  };

  return (
    <>
      {/* Hero: type is the graphic; the particle field sits behind */}
      <section className={`${sectionPad} flex min-h-[100svh] flex-col justify-end pb-[10vh] pt-32`}>
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
              Tasks = the plan. Commits = what you did. State does the math.
            </p>
            <p className="mt-4 font-mono text-sm uppercase tracking-[0.18em] text-[#6F6F6B]">
              Study · Build · Write · Train · Design · Ship
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
                <Link href="#history">See the graph</Link>
              </Button>
            </div>
          </div>

        </div>
      </section>

      {/* History */}
      <section id="history" aria-labelledby="history-title" className={`${sectionPad} scroll-mt-16 py-[16vh]`}>
        <div className="max-w-3xl">
          <h2 id="history-title" className={`${displayHeading} text-[clamp(1.75rem,7.5vw,6rem)]`}>
            Your work has a history.
          </h2>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[#A9A9A6]">Every finished task lands on the graph.</p>
        </div>
        <ProductFrame path="/platform/history" caption="Execution graph and commit ledger in the State app, with demo data" className="mt-16">
          <Panel title="Execution · 1y" aside={`${formatNumber(yearCommits)} commits · +${formatNumber(yearExecution)}`}>
            <ExecutionGraph days={year} />
          </Panel>
          <Panel title="Commits">
            <CommitLedger commits={demoCommits(personal, 8)} tz={DEMO_TZ} now={personal.now} />
          </Panel>
        </ProductFrame>
      </section>

      {/* Metrics */}
      <section aria-labelledby="metrics-title" className={`${sectionPad} py-[16vh]`}>
        <h2 id="metrics-title" className={`${displayHeading} text-[clamp(1.75rem,7.5vw,6rem)]`}>
          Measure throughput, not busyness.
        </h2>
        <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[#A9A9A6]">Every number shows its formula. No vibes, just math.</p>

        <ProductFrame path="/platform/metrics?period=30d" caption="Metrics page in the State app, last 30 days of demo data" className="mt-16">
          <MetricsReport metrics={demoMetrics(personal, 30)} series={demoSeries(personal, 30)} objectives={[]} tz={DEMO_TZ} period="30d" basePath={null} overview />
        </ProductFrame>
      </section>

      {/* Personal / organisation */}
      <section aria-labelledby="scope-title" className={`${sectionPad} py-[16vh]`}>
        <h2 id="scope-title" className={`${displayHeading} text-[clamp(1.75rem,7.5vw,6rem)]`}>
          Personal or organisational.
        </h2>
        <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[#A9A9A6]">Solo or squad. Same math.</p>
        <div className="mt-12">
          <WorkspaceScope boards={boards} doneWindowDays={DONE_WINDOW_DAYS} />
        </div>
      </section>

      {/* Refusals */}
      <section aria-labelledby="refusals-title" className={`${sectionPad} py-[16vh]`}>
        <h2 id="refusals-title" className={`${displayHeading} text-[clamp(1.75rem,7.5vw,6rem)]`}>
          No ads. No AI noise.
        </h2>
        <p className="mt-6 text-lg text-[#A9A9A6]">Never shipping:</p>
        <ul className="mt-10 space-y-1">
          {REFUSALS.map((item) => (
            <li
              key={item}
              className="font-display text-[clamp(1.5rem,4.2vw,3.5rem)] font-bold uppercase leading-[1.1] tracking-[-0.02em] [font-stretch:112%] text-[#4A4A47] line-through decoration-[#8B8B86] decoration-2"
            >
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-14 max-w-[40ch] text-xl leading-relaxed text-[#F4F4F2] text-pretty sm:text-2xl">Plan. Execute. Measure. That’s it.</p>
      </section>

      {/* Pricing */}
      <section id="pricing" aria-labelledby="pricing-title" className={`${sectionPad} scroll-mt-24 py-[16vh]`}>
        <h2 id="pricing-title" className={`${displayHeading} text-[clamp(1.75rem,7.5vw,6rem)]`}>
          Paid from day one.
        </h2>
        <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[#A9A9A6]">You pay. No ads. You’re the customer, not the product.</p>
        <div className="mt-14">
          <PricingLedger />
        </div>
      </section>

      {/* Closing */}
      <section className={`${sectionPad} flex min-h-[80svh] flex-col justify-center py-[12vh]`}>
        <h2 className={`${displayHeading} ${silver} text-[clamp(2.25rem,10vw,9.5rem)] leading-[0.88]`}>Start measuring.</h2>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <Magnetic strength={0.45} radius={160}>
            <Button asChild variant="dark-cta" size="lg" className="rounded-full px-8">
              <Link href="/register">
                <MagneticLabel>Subscribe</MagneticLabel>
              </Link>
            </Button>
          </Magnetic>
          <p className="text-base text-[#6F6F6B]">
            From {formatInr(PLANS.individual.priceInr.monthly)}/mo.
          </p>
        </div>
      </section>
    </>
  );
}

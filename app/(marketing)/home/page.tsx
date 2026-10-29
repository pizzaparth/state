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
import { PLANS, PLAN_IDS, formatInr } from "@/lib/billing/plans";
import { COMPARISONS } from "@/lib/compare";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import { LEGAL } from "@/lib/legal";
import { JsonLd } from "@/components/marketing/json-ld";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  alternates: { canonical: "/" },
};

const silver = "bg-gradient-to-b from-white via-[#D9D9D5] to-[#6F6F6B] bg-clip-text text-transparent";
const displayHeading =
  "font-display font-extrabold uppercase leading-[0.92] tracking-[-0.03em] [font-stretch:125%] text-balance";
const sectionPad = "mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12";
const kicker = "mb-6 font-mono text-sm uppercase tracking-[0.18em] text-[#85857F]";

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

// Plain answers to what people search before picking a to-do app
const FAQ = [
  {
    q: "What is State?",
    a: "A to-do list and kanban app that records finished work. Tasks are the plan. When a task is done it becomes a commit, and State turns commits into execution, velocity, throughput, cycle time and consistency.",
  },
  {
    q: "How is it different from Notion, Trello or Todoist?",
    a: "Those tools organise tasks. State also measures them: every task has a weight (Small 1, Normal 2, Major 4, Milestone 8), every finished task is logged, and every metric shows its formula.",
  },
  {
    q: "Is it only for software teams?",
    a: "No. It works for studying, writing, training, design or building anything, alone or with a team.",
  },
  {
    q: "Does State use AI or track employees?",
    a: "No. No AI summaries or chat, no keystroke or hours-online tracking, no leaderboards and no unexplained productivity score.",
  },
  {
    q: "How much does it cost?",
    a: `Individual is ${formatInr(PLANS.individual.priceInr.monthly)}/month. Organisation is ${formatInr(PLANS.organisation.priceInr.monthly)} per member per month. No ads, no free tier.`,
  },
];

function structuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE_URL}/#org`, name: LEGAL.entity, url: SITE_URL },
      { "@type": "WebSite", "@id": `${SITE_URL}/#site`, name: SITE_NAME, url: SITE_URL, publisher: { "@id": `${SITE_URL}/#org` } },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Task management",
        operatingSystem: "Web",
        publisher: { "@id": `${SITE_URL}/#org` },
        offers: PLAN_IDS.map((id) => ({
          "@type": "Offer",
          name: PLANS[id].name,
          price: PLANS[id].priceInr.monthly,
          priceCurrency: "INR",
          url: `${SITE_URL}/pricing`,
        })),
      },
    ],
  };
}

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
      <JsonLd data={structuredData()} />

      {/* Hero: type is the graphic; the particle field sits behind */}
      <section className={`${sectionPad} flex min-h-[100svh] flex-col justify-end pb-[10vh] pt-32`}>
        <p className={`${kicker} animate-fade-in`}>To-do list · Kanban · Metrics</p>
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
            <p className="max-w-[44ch] text-xl leading-snug text-[#F4F4F2] text-pretty sm:text-2xl">
              Applying quantitative methods to human execution.
            </p>
            <p className="mt-3 max-w-[44ch] text-lg leading-relaxed text-[#A9A9A6] text-pretty sm:text-xl">
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
          <p className={kicker}>Execution is a time series.</p>
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
        <p className={kicker}>Operational metrics for personal execution.</p>
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
        <p className={kicker}>Human execution, measured like a system.</p>
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
        <p className={kicker}>Productivity, without the productivity language.</p>
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
        <p className={kicker}>Quantitative infrastructure for getting work done.</p>
        <h2 id="pricing-title" className={`${displayHeading} text-[clamp(1.75rem,7.5vw,6rem)]`}>
          Paid from day one.
        </h2>
        <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[#A9A9A6]">You pay. No ads. You’re the customer, not the product.</p>
        <div className="mt-14">
          <PricingLedger />
        </div>
      </section>

      {/* Switching from: internal links to the comparison pages */}
      <section aria-labelledby="compare-title" className={`${sectionPad} py-[16vh]`}>
        <p className={kicker}>From tasks to telemetry.</p>
        <h2 id="compare-title" className={`${displayHeading} text-[clamp(1.75rem,7.5vw,6rem)]`}>
          Switching from…
        </h2>
        {/* Seven tools: the last cell spans two so neither the 2- nor 4-column grid leaves a gap */}
        <ul className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.08] sm:grid-cols-4">
          {COMPARISONS.map((c) => (
            <li key={c.slug} className="bg-[#050505] last:col-span-2">
              <Link
                href={`/compare/${c.slug}`}
                className="flex min-h-24 flex-col justify-between gap-3 p-5 transition-colors hover:bg-[#0E0E0E] focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-white"
              >
                <span className="min-w-0 break-words font-display text-lg font-bold uppercase tracking-[-0.01em] [font-stretch:112%] sm:text-xl" translate="no">
                  {c.name}
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-[#85857F]">State vs {c.name} →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-title" className={`${sectionPad} py-[16vh]`}>
        <p className={kicker}>A measurement system for execution.</p>
        <h2 id="faq-title" className={`${displayHeading} text-[clamp(1.75rem,7.5vw,6rem)]`}>
          Questions.
        </h2>
        <dl className="mt-12 divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {FAQ.map((item) => (
            <div key={item.q} className="grid gap-3 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-12">
              <dt className="text-xl font-semibold text-[#F4F4F2] text-balance">{item.q}</dt>
              <dd className="max-w-[60ch] text-lg leading-relaxed text-[#A9A9A6] text-pretty">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Closing */}
      <section className={`${sectionPad} flex min-h-[80svh] flex-col justify-center py-[12vh]`}>
        <p className={kicker}>Where execution becomes data.</p>
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

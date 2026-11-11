import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Magnetic, MagneticLabel } from "@/components/marketing/magnetic";
import { WorkspaceScope } from "@/components/marketing/workspace-scope";
import { ProductFrame } from "@/components/marketing/product-frame";
import { LiveDemo } from "@/components/marketing/live-demo";
import { PlayOnView } from "@/components/motion/play-on-view";
import { ExecutionGraph } from "@/components/app/execution-graph";
import { CommitLedger } from "@/components/app/commit-ledger";
import { MetricsReport } from "@/components/app/metrics-view";
import { Panel } from "@/components/app/primitives";
import { DEMO_TZ, demoBoard, demoCommits, demoDaily, demoMetrics, demoSeries, demoWorkspaces } from "@/lib/demo/workspace";
import { formatNumber } from "@/lib/format";
import { COMPARISONS } from "@/lib/compare";
import { AUTHOR, BYLINE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import { JsonLd } from "@/components/marketing/json-ld";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  alternates: { canonical: "/" },
};

const silver = "bg-gradient-to-b from-white via-[#DCE2F2] to-[#8E9AC0] bg-clip-text text-transparent";
const displayHeading =
  "font-display font-extrabold uppercase leading-[0.92] tracking-[-0.03em] [font-stretch:125%] text-balance";
const sectionPad = "mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12";
const kicker = "mb-6 font-mono text-sm uppercase tracking-[0.18em] text-accent";

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
    q: "Who built it?",
    a: `${AUTHOR}. State is a personal hobby project: one owner account, plus a demo anyone can open.`,
  },
  {
    q: "Is it only for software?",
    a: "No. It works for studying, writing, training, design or building anything.",
  },
  {
    q: "Does State use AI or track employees?",
    a: "No. No AI summaries or chat, no keystroke or hours-online tracking, no leaderboards and no unexplained productivity score.",
  },
  {
    q: "What happens to demo data?",
    a: "Nothing is kept. The demo workspace survives a refresh, and is deleted when you sign out or close the tab.",
  },
];

function structuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Person", "@id": `${SITE_URL}/#author`, name: AUTHOR },
      { "@type": "WebSite", "@id": `${SITE_URL}/#site`, name: SITE_NAME, url: SITE_URL, author: { "@id": `${SITE_URL}/#author` } },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Task management",
        operatingSystem: "Web",
        author: { "@id": `${SITE_URL}/#author` },
      },
    ],
  };
}

export default function LandingPage() {
  // The real product screens, fed by a generated demo workspace (lib/demo/workspace.ts)
  const { personal } = demoWorkspaces();
  const year = demoDaily(personal, 371);
  const yearCommits = year.reduce((n, d) => n + d.commits, 0);
  const yearExecution = year.reduce((n, d) => n + d.execution, 0);
  const board = demoBoard(personal, "personal", DONE_WINDOW_DAYS);

  return (
    <>
      <JsonLd data={structuredData()} />

      {/* Hero: type is the graphic; the particle field sits behind */}
      <section className={`${sectionPad} flex min-h-[100svh] flex-col justify-end pb-[10vh] pt-32`}>
        <p data-depth="-0.08" suppressHydrationWarning className={`${kicker} animate-fade-in`}>
          {BYLINE}
        </p>
        <h1 className={`${displayHeading} text-[clamp(2.25rem,10vw,9.5rem)] leading-[0.86]`}>
          {/* Lower lines lag more, so the lines spread apart on scroll and never overlap */}
          <span data-depth="0" suppressHydrationWarning className="block overflow-hidden pb-[0.04em]">
            <span className={`block animate-line-rise ${silver}`}>Execution,</span>
          </span>
          <span data-depth="0.06" suppressHydrationWarning className="block overflow-hidden pb-[0.06em]">
            <span className="block animate-line-rise text-[#E8357F] [animation-delay:120ms]">measured.</span>
          </span>
        </h1>

        <div className="mt-10 animate-fade-in [animation-delay:500ms]">
          <div data-depth="0.1" suppressHydrationWarning>
            <p className="max-w-[44ch] text-xl leading-snug text-[#FFFFFF] text-pretty sm:text-2xl">
              Applying quantitative methods to human execution.
            </p>
            <p className="mt-3 max-w-[44ch] text-lg leading-relaxed text-[#B4BEDB] text-pretty sm:text-xl">
              Tasks = the plan. Commits = what you did. State does the math.
            </p>
            <p className="mt-4 font-mono text-sm uppercase tracking-[0.18em] text-[#8E9AC0]">
              Study · Build · Write · Train · Design · Ship
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Magnetic>
                <Button asChild variant="dark-cta" size="lg" className="rounded-full px-7">
                  <Link href="/demo" prefetch={false}>
                    <MagneticLabel>Take a demo</MagneticLabel>
                  </Link>
                </Button>
              </Magnetic>
              <Button asChild variant="dark-secondary" size="lg" className="group rounded-full px-7">
                <Link href="#history">
                  See the graph <span aria-hidden="true" className="mi-arrow ml-1 inline-block">↓</span>
                </Link>
              </Button>
            </div>
          </div>

        </div>
      </section>

      {/* Live walkthrough: the whole loop, played like a screen recording */}
      <section aria-labelledby="loop-title" className={`${sectionPad} py-[12vh]`}>
        <p className={kicker}>Capture. Move. Commit. Measure.</p>
        <h2 id="loop-title" data-depth="0.03" suppressHydrationWarning className={`${displayHeading} text-[clamp(1.75rem,7.5vw,6rem)]`}>
          Watch one task become data.
        </h2>
        <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[#B4BEDB]">Type it. Drag it to Done. The commit, the day’s total and the graph update at once.</p>
        <ProductFrame path="/platform/today" caption="Animated walkthrough of capturing a task and finishing it in the State app" className="mt-16">
          <LiveDemo />
        </ProductFrame>
      </section>

      {/* History */}
      <section id="history" aria-labelledby="history-title" className={`${sectionPad} scroll-mt-16 py-[16vh]`}>
        <div className="max-w-3xl">
          <p className={kicker}>Execution is a time series.</p>
          <h2 id="history-title" data-depth="0.03" suppressHydrationWarning className={`${displayHeading} text-[clamp(1.75rem,7.5vw,6rem)]`}>
            Your work has a history.
          </h2>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[#B4BEDB]">Every finished task lands on the graph.</p>
        </div>
        <ProductFrame path="/platform/history" caption="Execution graph and commit ledger in the State app, with demo data" className="mt-16">
          <PlayOnView className="space-y-5">
            <Panel title="Execution · 1y" aside={`${formatNumber(yearCommits)} commits · +${formatNumber(yearExecution)}`}>
              <ExecutionGraph days={year} />
            </Panel>
            <Panel title="Commits">
              <div className="app-stagger">
                <CommitLedger commits={demoCommits(personal, 8)} tz={DEMO_TZ} now={personal.now} />
              </div>
            </Panel>
          </PlayOnView>
        </ProductFrame>
      </section>

      {/* Metrics */}
      <section aria-labelledby="metrics-title" className={`${sectionPad} py-[16vh]`}>
        <p className={kicker}>Operational metrics for personal execution.</p>
        <h2 id="metrics-title" data-depth="0.03" suppressHydrationWarning className={`${displayHeading} text-[clamp(1.75rem,7.5vw,6rem)]`}>
          Measure throughput, not busyness.
        </h2>
        <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[#B4BEDB]">Every number shows its formula. No vibes, just math.</p>

        <ProductFrame path="/platform/metrics?period=30d" caption="Metrics page in the State app, last 30 days of demo data" className="mt-16">
          <PlayOnView>
            <MetricsReport metrics={demoMetrics(personal, 30)} series={demoSeries(personal, 30)} objectives={[]} tz={DEMO_TZ} period="30d" basePath={null} overview />
          </PlayOnView>
        </ProductFrame>
      </section>

      {/* Board */}
      <section aria-labelledby="scope-title" className={`${sectionPad} py-[16vh]`}>
        <p className={kicker}>Human execution, measured like a system.</p>
        <h2 id="scope-title" data-depth="0.03" suppressHydrationWarning className={`${displayHeading} text-[clamp(1.75rem,7.5vw,6rem)]`}>
          One board. One person.
        </h2>
        <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[#B4BEDB]">Queued, Active, Done. Same math every day.</p>
        <div className="mt-12">
          <WorkspaceScope board={board} doneWindowDays={DONE_WINDOW_DAYS} />
        </div>
      </section>

      {/* Refusals */}
      <section aria-labelledby="refusals-title" className={`${sectionPad} py-[16vh]`}>
        <p className={kicker}>Productivity, without the productivity language.</p>
        <h2 id="refusals-title" data-depth="0.03" suppressHydrationWarning className={`${displayHeading} text-[clamp(1.75rem,7.5vw,6rem)]`}>
          No ads. No AI noise.
        </h2>
        <p className="mt-6 text-lg text-[#B4BEDB]">Never shipping:</p>
        <PlayOnView>
          <ul className="mt-10 space-y-1">
            {REFUSALS.map((item, i) => (
              <li
                key={item}
                style={{ animationDelay: `${300 + i * 140}ms` }}
                className="mi-strike w-fit font-display text-[clamp(1.5rem,4.2vw,3.5rem)] font-bold uppercase leading-[1.1] tracking-[-0.02em] [font-stretch:112%] text-[#4A5C8C]"
              >
                {item}
              </li>
            ))}
          </ul>
        </PlayOnView>
        <p className="mt-14 max-w-[40ch] text-xl leading-relaxed text-[#FFFFFF] text-pretty sm:text-2xl">Plan. Execute. Measure. That’s it.</p>
      </section>

      {/* Switching from: internal links to the comparison pages */}
      <section aria-labelledby="compare-title" className={`${sectionPad} py-[16vh]`}>
        <p className={kicker}>From tasks to telemetry.</p>
        <h2 id="compare-title" data-depth="0.03" suppressHydrationWarning className={`${displayHeading} text-[clamp(1.75rem,7.5vw,6rem)]`}>
          Switching from…
        </h2>
        {/* Seven tools: the last cell spans two so neither the 2- nor 4-column grid leaves a gap */}
        <ul className="mt-12 grid grid-cols-2 border-t border-white/[0.1] sm:grid-cols-4">
          {COMPARISONS.map((c) => (
            <li key={c.slug} className="border-b border-white/[0.1] last:col-span-2 sm:[&:not(:nth-child(4n))]:border-r">
              <Link
                href={`/compare/${c.slug}`}
                className="mi-row group flex h-full min-h-24 flex-col justify-between gap-3 p-5"
              >
                <span className="min-w-0 break-words font-display text-lg font-bold uppercase tracking-[-0.01em] [font-stretch:112%] sm:text-xl" translate="no">
                  {c.name}
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-accent">
                  State vs {c.name} <span className="mi-arrow inline-block">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-title" className={`${sectionPad} py-[16vh]`}>
        <p className={kicker}>A measurement system for execution.</p>
        <h2 id="faq-title" data-depth="0.03" suppressHydrationWarning className={`${displayHeading} text-[clamp(1.75rem,7.5vw,6rem)]`}>
          Questions.
        </h2>
        <dl className="mt-12 divide-y divide-white/[0.1] border-y border-white/[0.1]">
          {FAQ.map((item) => (
            <div key={item.q} className="mi-row grid gap-3 px-2 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-12">
              <dt className="text-xl font-semibold text-[#FFFFFF] text-balance">{item.q}</dt>
              <dd className="max-w-[60ch] text-lg leading-relaxed text-[#B4BEDB] text-pretty">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Closing */}
      <section className={`${sectionPad} flex min-h-[80svh] flex-col justify-center py-[12vh]`}>
        <p className={kicker}>Where execution becomes data.</p>
        <h2 className={`${displayHeading} text-[#E8357F] text-[clamp(2.25rem,10vw,9.5rem)] leading-[0.88]`}>Take a look.</h2>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <Magnetic strength={0.45} radius={160}>
            <Button asChild variant="dark-cta" size="lg" className="rounded-full px-8">
              <Link href="/demo" prefetch={false}>
                <MagneticLabel>Take a demo</MagneticLabel>
              </Link>
            </Button>
          </Magnetic>
          <p className="text-base text-[#8E9AC0]">No sign-up. Nothing kept.</p>
        </div>
      </section>
    </>
  );
}

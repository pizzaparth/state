import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Magnetic, MagneticLabel } from "@/components/marketing/magnetic";
import { ProductFrame } from "@/components/marketing/product-frame";
import { LiveDemo } from "@/components/marketing/live-demo";
import { JsonLd } from "@/components/marketing/json-ld";
import { PlayOnView } from "@/components/motion/play-on-view";
import { CountUp } from "@/components/app/count-up";
import { demoMetrics, demoWorkspaces } from "@/lib/demo/workspace";
import { calculateCompletionRate, calculateConsistency, calculateMedianCycleTimeHours, calculateThroughput, calculateVelocity } from "@/lib/metrics";
import { formatNumber } from "@/lib/format";
import { AUTHOR, BYLINE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  alternates: { canonical: "/" },
};

const silver = "bg-gradient-to-b from-white via-[#DCE2F2] to-[#8E9AC0] bg-clip-text text-transparent";
const displayHeading = "font-display font-extrabold uppercase leading-[0.92] tracking-[-0.03em] [font-stretch:125%] text-balance";
const sectionPad = "mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12";
const kicker = "mb-4 font-mono text-sm uppercase tracking-[0.18em] text-accent";
const h2 = `${displayHeading} text-[clamp(1.75rem,5.5vw,4rem)]`;

const REFUSALS = ["No ads", "No AI", "No streaks", "No surveillance", "No payments"];

const STACK = ["Next.js", "TypeScript", "PostgreSQL", "Drizzle", "Better Auth", "Tailwind", "Vercel"];

const REPO = "https://github.com/pizzaparth/state";

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
  // Real numbers from the generated demo workspace (lib/demo/workspace.ts), last 30 days
  const m = demoMetrics(demoWorkspaces().personal, 30);
  const formulas = [
    { name: "Execution", value: `+${formatNumber(m.execution)}`, formula: "Σ task weights + Σ manual weights" },
    { name: "Velocity", value: formatNumber(calculateVelocity(m.execution, m.days), 1), unit: "/day", formula: "Execution ÷ days" },
    { name: "Throughput", value: formatNumber(calculateThroughput(m.tasksCompleted, m.days), 1), unit: "/day", formula: "Done tasks ÷ days" },
    { name: "Completion", value: `${formatNumber(calculateCompletionRate(m.plannedCompleted, m.plannedTasks), 0)}%`, formula: "Done planned ÷ planned" },
    { name: "Cycle time", value: formatNumber(calculateMedianCycleTimeHours(m.cycleTimesMs), 1), unit: "h", formula: "median(done − started)" },
    { name: "Consistency", value: `${formatNumber(calculateConsistency(m.activeDays, m.days), 0)}%`, formula: "Active days ÷ days" },
  ];

  return (
    <>
      <JsonLd data={structuredData()} />

      {/* 1. Hero */}
      <section className={`${sectionPad} flex min-h-[88svh] flex-col justify-end pb-[8vh] pt-32`}>
        <p data-depth="-0.08" suppressHydrationWarning className={`${kicker} mb-6 animate-fade-in`}>
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

        <div data-depth="0.1" suppressHydrationWarning className="mt-8 animate-fade-in [animation-delay:500ms]">
          <p className="max-w-[44ch] text-xl leading-snug text-white text-pretty sm:text-2xl">Tasks are the plan. Commits are the work. State does the math.</p>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm uppercase tracking-[0.16em] text-[#8E9AC0]" aria-label="What State leaves out">
            {REFUSALS.map((r) => (
              <li key={r} className="flex items-center gap-4 [&:not(:first-child)]:before:text-accent [&:not(:first-child)]:before:content-['·']">
                {r}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Magnetic>
              <Button asChild variant="dark-cta" size="lg" className="rounded-full px-7">
                <Link href="/demo" prefetch={false}>
                  <MagneticLabel>Take a demo</MagneticLabel>
                </Link>
              </Button>
            </Magnetic>
            <Button asChild variant="dark-secondary" size="lg" className="group rounded-full px-7">
              <Link href="#loop">
                Watch it work <span aria-hidden="true" className="mi-arrow ml-1 inline-block">↓</span>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. Walkthrough: the whole loop, played like a screen recording */}
      <section id="loop" aria-labelledby="loop-title" className={`${sectionPad} scroll-mt-20 py-[8vh]`}>
        <p className={kicker}>Capture · Move · Commit · Measure</p>
        <h2 id="loop-title" data-depth="0.03" suppressHydrationWarning className={h2}>
          One task becomes data.
        </h2>
        <ProductFrame path="/platform/today" caption="Animated walkthrough of capturing a task and finishing it in the State app" className="mt-10">
          <LiveDemo />
        </ProductFrame>
      </section>

      {/* 3. Formulas: every metric with the math behind it */}
      <section aria-labelledby="math-title" className={`${sectionPad} py-[8vh]`}>
        <p className={kicker}>Last 30 days of demo data</p>
        <h2 id="math-title" data-depth="0.03" suppressHydrationWarning className={h2}>
          Every number shows its formula.
        </h2>
        <PlayOnView>
          <ul className="app-stagger mt-10 grid grid-cols-2 gap-3 lg:grid-cols-3">
            {formulas.map((f) => (
              <li key={f.name} className="app-card mi-lift rounded-[20px] p-5">
                <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#B4BEDB]">{f.name}</p>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-none tabular-nums [font-stretch:125%]">
                    <CountUp value={f.value} duration={900} />
                  </span>
                  {f.unit && <span className="font-mono text-sm text-[#8E9AC0]">{f.unit}</span>}
                </p>
                <p className="mt-3 font-mono text-[12px] text-accent">{f.formula}</p>
              </li>
            ))}
          </ul>
        </PlayOnView>
      </section>

      {/* 4. About */}
      <section aria-labelledby="about-title" className={`${sectionPad} pb-[10vh] pt-[8vh]`}>
        <div className="grid gap-10 border-t border-white/[0.1] pt-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className={kicker}>About</p>
            <h2 id="about-title" className={h2}>
              Built by <span className="text-[#E8357F]">{AUTHOR}</span>.
            </h2>
            <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-[#B4BEDB] text-pretty">
              A personal hobby project: a to-do list and kanban board that measures finished work. One owner account, and a demo anyone can open.
              Nothing you do in the demo is kept.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Magnetic strength={0.4} radius={140}>
                <Button asChild variant="dark-cta" size="lg" className="rounded-full px-7">
                  <Link href="/demo" prefetch={false}>
                    <MagneticLabel>Take a demo</MagneticLabel>
                  </Link>
                </Button>
              </Magnetic>
              <Button asChild variant="dark-secondary" size="lg" className="group rounded-full px-7">
                <a href={REPO} target="_blank" rel="noopener noreferrer">
                  Source on GitHub <span aria-hidden="true" className="mi-arrow ml-1 inline-block">↗</span>
                </a>
              </Button>
            </div>
          </div>

          <dl className="grid content-start gap-6">
            <div>
              <dt className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#B4BEDB]">Built with</dt>
              <dd className="mt-3 flex flex-wrap gap-2">
                {STACK.map((s) => (
                  <span key={s} className="app-btn mi-lift rounded-full px-3 py-1 text-sm" translate="no">
                    {s}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#B4BEDB]">Tested</dt>
              <dd className="mt-3 grid grid-cols-2 gap-3">
                <p>
                  <span className="font-display text-3xl font-extrabold tabular-nums [font-stretch:125%]">115</span>
                  <span className="mt-1 block font-mono text-[12px] text-[#8E9AC0]">tenant isolation checks</span>
                </p>
                <p>
                  <span className="font-display text-3xl font-extrabold tabular-nums [font-stretch:125%]">41</span>
                  <span className="mt-1 block font-mono text-[12px] text-[#8E9AC0]">black-box security checks</span>
                </p>
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </>
  );
}

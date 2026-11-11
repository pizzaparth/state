import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Magnetic, MagneticLabel } from "@/components/marketing/magnetic";
import { ProductShot } from "@/components/marketing/product-shot";
import { Bento } from "@/components/marketing/bento";
import { JsonLd } from "@/components/marketing/json-ld";
import { PlayOnView } from "@/components/motion/play-on-view";
import { demoDaily, demoMetrics, demoWorkspaces } from "@/lib/demo/workspace";
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
  const { personal } = demoWorkspaces();
  const m = demoMetrics(personal, 30);
  const shotDays = demoDaily(personal, 40 * 7);
  const yearDays = demoDaily(personal, 52 * 7);
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

      {/* Hero */}
      <section className={`${sectionPad} pb-[6vh] pt-36 sm:pt-44`}>
        <p data-depth="-0.08" suppressHydrationWarning className={`${kicker} mb-6 animate-fade-in`}>
          {BYLINE}
        </p>
        <h1 className={`${displayHeading} text-[clamp(2.25rem,10vw,9.5rem)] leading-[0.86]`}>
          {/* Lower lines lag more, so the lines spread apart on scroll and never overlap */}
          <span data-depth="0" suppressHydrationWarning className="block overflow-hidden pb-[0.04em]">
            <span className={`block animate-line-rise ${silver}`}>Execution,</span>
          </span>
          <span data-depth="0.06" suppressHydrationWarning className="block overflow-hidden pb-[0.06em]">
            <span className="block animate-line-rise text-[#D92B74] [animation-delay:120ms]">measured.</span>
          </span>
        </h1>

        <div className="mt-8 animate-fade-in [animation-delay:500ms]">
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
              <Link href="#how">
                How it works <span aria-hidden="true" className="mi-arrow ml-1 inline-block">↓</span>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Product shot: the real Today screen, still and crisp */}
      <section aria-label="State's Today screen" className={`${sectionPad} pb-[10vh]`}>
        <div className="min-w-0">
          <div data-tilt suppressHydrationWarning>
            <ProductShot
              heat={shotDays.map((d) => d.execution)}
              commits={formatNumber(shotDays.reduce((n, d) => n + d.commits, 0))}
              execution={formatNumber(shotDays.reduce((n, d) => n + d.execution, 0))}
              caption="The Today screen: the day's execution, quick capture, 40 weeks of history, active tasks and today's commits, with demo data"
            />
          </div>
        </div>
      </section>

      {/* How it works: one idea per tile */}
      <section id="how" aria-labelledby="how-title" className={`${sectionPad} scroll-mt-20 py-[8vh]`}>
        <p className={kicker}>How it works</p>
        <h2 id="how-title" data-depth="0.03" suppressHydrationWarning className={h2}>
          Plan. Execute. Measure.
        </h2>
        <PlayOnView className="mt-10">
          <Bento heat={yearDays.map((d) => d.execution)} formulas={formulas} />
        </PlayOnView>
      </section>

      {/* About */}
      <section aria-labelledby="about-title" className={`${sectionPad} pb-[10vh] pt-[8vh]`}>
        <div className="grid gap-10 border-t border-white/[0.1] pt-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className={kicker}>About</p>
            <h2 id="about-title" className={h2}>
              Built by <span className="text-[#D92B74]">{AUTHOR}</span>.
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

import Link from "next/link";
import type { Metadata, Route } from "next";
import { ArrowRight, ArrowUpRight, CalendarDays, ChartColumn, Lock, Quote, ScanSearch, ShieldCheck, Sigma, Timer, Activity, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Magnetic, MagneticLabel } from "@/components/marketing/magnetic";
import { PlatformDemo } from "@/components/marketing/platform-demo";
import { BrandTile } from "@/components/marketing/brand-logos";
import {
  BarsMini,
  CaptureLine,
  CommitLedger,
  DemoChecks,
  FormulaGrid,
  Heatmap,
  KanbanMini,
  TaskToCommit,
  TodayCard,
  WeightBars,
  type Formula,
} from "@/components/marketing/mini-screens";
import { JsonLd } from "@/components/marketing/json-ld";
import { PlayOnView } from "@/components/motion/play-on-view";
import { Reveal } from "@/components/motion/reveal";
import { Marquee } from "@/components/motion/marquee";
import { ScrollWords } from "@/components/motion/scroll-words";
import { WordCycler } from "@/components/motion/word-cycler";
import { CountUp } from "@/components/app/count-up";
import { demoDaily, demoMetrics, demoWorkspaces } from "@/lib/demo/workspace";
import { calculateCompletionRate, calculateConsistency, calculateMedianCycleTimeHours, calculateThroughput, calculateVelocity } from "@/lib/metrics";
import { formatNumber } from "@/lib/format";
import { COMPARISONS } from "@/lib/compare";
import { AUTHOR, BYLINE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  alternates: { canonical: "/" },
};

// Prerendered and served from the CDN. The sample figures are dated relative to today,
// so the page is rebuilt once a day.
export const revalidate = 86400;

// Black on white, tight grotesk; the accent marks data and one icon tile (about 15%)
const container = "mx-auto w-full max-w-[1120px] px-5 sm:px-8";
const heading = "font-semibold tracking-[-0.045em] text-balance";
const h2 = `${heading} text-[clamp(2rem,4.6vw,3.5rem)] leading-[1.02]`;
const muted = "text-[#71717A]";
const card = "rounded-[28px] bg-[#F5F5F5]";

const REPO = "https://github.com/pizzaparth/state";
const DISCIPLINES = ["Study", "Build", "Write", "Train", "Design", "Research", "Run", "Ship", "Practise", "Read"];

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

/** Words that rise from below their own line, one after another */
function Words({ text, start = 0, base = 0 }: { text: string; start?: number; base?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i}>
          <span className="word-mask">
            <span className="word-rise" style={{ "--w": start + i, "--word-base": `${base}ms` } as React.CSSProperties}>
              {w}
            </span>
          </span>{" "}
        </span>
      ))}
    </>
  );
}

function PrimaryButtons({ secondary }: { secondary: { href: string; label: string; external?: boolean } }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Magnetic strength={0.3} radius={90}>
        <Button asChild variant="light-cta" size="md" className="h-11 rounded-full px-5 text-[15px]">
          <Link href="/demo" prefetch={false}>
            <MagneticLabel>Take a demo</MagneticLabel>
          </Link>
        </Button>
      </Magnetic>
      <Button asChild variant="light-secondary" size="md" className="group h-11 rounded-full px-5 text-[15px] font-semibold">
        {secondary.external ? (
          <a href={secondary.href} target="_blank" rel="noopener noreferrer">
            {secondary.label} <ArrowRight aria-hidden="true" className="mi-arrow ml-1.5 size-4" />
          </a>
        ) : (
          <Link href={secondary.href as Route}>
            {secondary.label} <ArrowRight aria-hidden="true" className="mi-arrow ml-1.5 size-4" />
          </Link>
        )}
      </Button>
    </div>
  );
}

/** One column of brand tiles drifting up or down forever, like a shelf of app icons */
function LogoColumn({ names, reverse, duration, offset }: { names: string[]; reverse?: boolean; duration: number; offset?: boolean }) {
  return (
    <Marquee label="Compared tools" vertical reverse={reverse} duration={duration} controls={false} className={cn("h-full w-24 sm:w-28", offset && "mt-16")}>
      {names.map((n, i) => (
        <span key={`${n}-${i}`} className="block py-2">
          <BrandTile
            name={n}
            className="float-tile size-20 sm:size-24"
            style={{ "--r": `${(i % 2 ? 1 : -1) * (3 + (i % 3) * 2)}deg`, "--float-d": `${3.4 + (i % 4) * 0.6}s` } as React.CSSProperties}
          />
        </span>
      ))}
    </Marquee>
  );
}

export default function LandingPage() {
  // Real numbers from the generated demo workspace (lib/demo/workspace.ts), last 30 days
  const { personal } = demoWorkspaces();
  const m = demoMetrics(personal, 30);
  const shotDays = demoDaily(personal, 26 * 7);
  const yearDays = demoDaily(personal, 52 * 7);
  const weekDays = demoDaily(personal, 7);
  const weekExecution = weekDays.reduce((n, d) => n + d.execution, 0);
  const formulas: Formula[] = [
    { name: "Execution", value: `+${formatNumber(m.execution)}`, formula: "Σ task + Σ manual weights" },
    { name: "Velocity", value: formatNumber(calculateVelocity(m.execution, m.days), 1), unit: "/day", formula: "Execution ÷ days" },
    { name: "Throughput", value: formatNumber(calculateThroughput(m.tasksCompleted, m.days), 1), unit: "/day", formula: "Done tasks ÷ days" },
    { name: "Completion", value: `${formatNumber(calculateCompletionRate(m.plannedCompleted, m.plannedTasks), 0)}%`, formula: "Done planned ÷ planned" },
    { name: "Cycle time", value: formatNumber(calculateMedianCycleTimeHours(m.cycleTimesMs), 1), unit: "h", formula: "median(done − started)" },
    { name: "Consistency", value: `${formatNumber(calculateConsistency(m.activeDays, m.days), 0)}%`, formula: "Active days ÷ days" },
  ];

  const screens = [
    { name: "Today", wide: false, body: <TodayCard /> },
    {
      name: "Board",
      wide: true,
      body: (
        <div className="rounded-[16px] bg-white p-2.5">
          <KanbanMini />
        </div>
      ),
    },
    {
      name: "Capture",
      wide: true,
      body: (
        <div className="rounded-[16px] bg-white p-5">
          <CaptureLine />
        </div>
      ),
    },
    { name: "Commits", wide: false, body: <CommitLedger className="rounded-[16px] bg-white px-3 py-2" /> },
    {
      name: "History",
      wide: true,
      body: (
        <div className="rounded-[16px] bg-white p-5">
          <Heatmap heat={yearDays.map((d) => d.execution)} />
        </div>
      ),
    },
    {
      name: "Metrics",
      wide: false,
      body: (
        <div className="rounded-[16px] bg-white p-5">
          <BarsMini values={demoDaily(personal, 14).map((d) => d.execution)} />
        </div>
      ),
    },
    {
      name: "Weights",
      wide: false,
      body: (
        <div className="rounded-[16px] bg-white p-5">
          <WeightBars />
        </div>
      ),
    },
  ];

  const library = [
    { title: "Capture", body: <CaptureLine big className="w-full text-left" /> },
    { title: "Weights", body: <WeightBars big className="w-full text-left" /> },
    { title: "Commits", body: <TaskToCommit big className="w-full text-left" /> },
    { title: "Board", body: <KanbanMini big className="w-full text-left" /> },
    { title: "History", body: <Heatmap heat={shotDays.slice(-13 * 7).map((d) => d.execution)} cell="rounded-[4px]" className="w-full" /> },
    { title: "Demo", body: <DemoChecks big className="text-left" /> },
  ];

  const proof = [
    { label: "Tenant isolation", icon: ShieldCheck, value: "115", text: "checks that one workspace never reads another’s data." },
    { label: "Security", icon: Lock, value: "41", text: "black-box checks against the running app." },
    { label: "Accounts", icon: UserRound, value: "1", text: "owner. Every demo is deleted on sign-out." },
  ];

  const tools = COMPARISONS.map((c) => c.name);
  const half = Math.ceil(tools.length / 2);
  const left = tools.slice(0, half);
  const right = tools.slice(half);
  // Repeat so each column is taller than the section and the loop never shows a gap
  const fill = (names: string[], shift = 0) => Array.from({ length: 8 }, (_, i) => names[(i + shift) % names.length]);

  return (
    <>
      <JsonLd data={structuredData()} />

      {/* Hero */}
      <section className={`${container} flex flex-col items-center pb-16 pt-20 text-center sm:pb-20 sm:pt-28`}>
        <h1 className={`${heading} max-w-[16ch] text-[clamp(2.6rem,7.2vw,5.25rem)] leading-[1.04]`}>
          <Words text="Where tasks become commits and work becomes" />
          <span className="word-mask">
            <span className="word-rise inline-block" style={{ "--w": 7 } as React.CSSProperties}>
              <WordCycler words={["numbers.", "velocity.", "throughput.", "history.", "progress."]} className="text-accent [color:#D92B74]" />
            </span>
          </span>
        </h1>
        <p className={`mt-6 max-w-[38ch] animate-fade-in text-lg leading-snug [animation-delay:700ms] sm:text-xl ${muted}`}>
          A to-do list and kanban board that measures finished work. Six plain formulas, no scores.
        </p>
        <div className="mt-9 animate-fade-in [animation-delay:900ms]">
          <PrimaryButtons secondary={{ href: "#loop", label: "How it works" }} />
        </div>
      </section>

      {/* The app, framed: tilts up as it scrolls in */}
      <section aria-label="State's app" className="mx-auto w-full max-w-[1200px] px-3 sm:px-5">
        <div className="animate-fade-in [animation-delay:1000ms]">
          <div data-tilt suppressHydrationWarning>
            <PlatformDemo caption="State's app in use: a task is captured and finished, today's execution rises, then Metrics and the Personal board open, with demo data" />
          </div>
        </div>
      </section>

      {/* Disciplines strip, always moving */}
      <section aria-labelledby="any-work" className="py-16 sm:py-20">
        <Reveal as="h2" id="any-work" className={`text-center text-[15px] ${muted}`}>
          Built for any kind of work
        </Reveal>
        <Reveal variant="scale" delay={120}>
          <Marquee label="Kinds of work" duration={34} controls={false} className="mx-auto mt-7 max-w-[1120px]">
            {DISCIPLINES.map((d) => (
              <span key={d} className="mx-7 text-[clamp(1.5rem,3vw,2.25rem)] font-semibold tracking-[-0.05em] text-[#A1A1AA] transition-colors hover:text-[#0A0A0A] sm:mx-10">
                {d}
              </span>
            ))}
          </Marquee>
        </Reveal>
      </section>

      {/* Problem statement: the grey paragraph darkens word by word as it scrolls */}
      <section aria-labelledby="problem" className={`${container} py-16 sm:py-28`}>
        <Reveal as="h2" id="problem" className={`${heading} text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.12]`}>
          Planning felt productive.
          <br />
          Nothing measured the doing.
        </Reveal>
        <ScrollWords
          text="Every list counts what you wrote down. None of them count what you finished, or how fast you finish it."
          className={`${heading} mt-10 max-w-[30ch] text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.12]`}
        />
      </section>

      {/* Screens: one continuous strip that moves on its own */}
      <section id="loop" aria-labelledby="loop-title" className="scroll-mt-24 pb-20 pt-4 sm:pb-28">
        <Reveal variant="left" className={container}>
          <h2 id="loop-title" className={`${heading} flex items-center gap-3 text-[clamp(1.75rem,3.6vw,2.75rem)] leading-none`}>
            <ScanSearch aria-hidden="true" className="size-[0.8em] shrink-0" strokeWidth={2} />
            One loop, seven screens
          </h2>
        </Reveal>
        <Reveal variant="right" delay={150}>
          <PlayOnView>
            <Marquee label="Screens of State" duration={70} fade={false} className="mt-10 pb-16">
              {screens.map((s) => (
                <figure key={s.name} className={cn("group/card mr-4 shrink-0", s.wide ? "w-[min(84vw,36rem)]" : "w-[min(72vw,20rem)]")}>
                  <div className={cn(card, "card-live flex h-[19rem] flex-col justify-center overflow-hidden p-6 sm:h-[22rem] sm:p-8")}>
                    <div className="card-art">{s.body}</div>
                  </div>
                  <figcaption className="card-label mt-3 flex items-center gap-1.5 px-2 text-[15px] font-medium">
                    {s.name}
                    <ArrowUpRight aria-hidden="true" className="size-4 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100" />
                  </figcaption>
                </figure>
              ))}
            </Marquee>
          </PlayOnView>
        </Reveal>
      </section>

      {/* Library grid */}
      <section aria-labelledby="library-title" className={`${container} py-16 sm:py-24`}>
        <Reveal as="h2" id="library-title" variant="scale" className={`${h2} mx-auto max-w-[16ch] text-center`}>
          One tracker for every kind of work.
        </Reveal>
        <PlayOnView className="mt-12 sm:mt-16">
          <Reveal as="ul" variant="group" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {library.map((item) => (
              <li key={item.title} className={cn(card, "card-live flex h-[22rem] flex-col items-center overflow-hidden px-5 pt-7 text-center sm:h-[24rem] sm:px-7")}>
                <h3 className="card-label text-[1.625rem] font-semibold tracking-[-0.04em]">{item.title}</h3>
                <div className="card-art flex w-full flex-1 items-center justify-center pb-7 pt-5">{item.body}</div>
              </li>
            ))}
          </Reveal>
        </PlayOnView>
      </section>

      {/* Formulas */}
      <section aria-labelledby="math-title" className={`${container} py-16 sm:py-24`}>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal variant="left">
            <h2 id="math-title" className={`${h2} max-w-[14ch]`}>
              Every number shows its math.
            </h2>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild variant="light-secondary" size="md" className="h-11 rounded-full px-5 text-[15px] font-semibold">
                <Link href="/principles">Read the principles</Link>
              </Button>
              <span className={`text-sm ${muted}`}>No scores. No ratings.</span>
            </div>
            <Reveal as="ul" variant="group" aria-label="Metrics" className="mt-12 flex flex-wrap gap-6">
              {(
                [
                  [Sigma, "Execution"],
                  [Activity, "Velocity"],
                  [ChartColumn, "Throughput"],
                  [Timer, "Cycle time"],
                  [CalendarDays, "Consistency"],
                ] as const
              ).map(([Icon, label]) => (
                <li key={label} title={label} className="mi-lift">
                  <Icon aria-hidden="true" className="size-8" strokeWidth={1.75} />
                  <span className="sr-only">{label}</span>
                </li>
              ))}
            </Reveal>
          </Reveal>

          <Reveal variant="right" delay={120} className={cn(card, "card-live p-5 sm:p-8")}>
            <PlayOnView>
              <div aria-hidden="true" className="ml-auto w-fit max-w-[85%] animate-toast-in rounded-[16px] bg-white px-4 py-3 text-[15px]">
                Execution, <b className="font-semibold">last 7 days</b>
              </div>
              <p aria-hidden="true" className={`mt-6 animate-fade-in text-sm [animation-delay:300ms] ${muted}`}>
                {weekDays.length} days · {formatNumber(weekDays.reduce((n, d) => n + d.commits, 0))} commits
              </p>
              <div className="card-art mt-3 rounded-[18px] bg-white p-5">
                <p className="font-mono text-[12px] text-[#71717A]">Σ task weights + Σ manual weights</p>
                <p className="mt-2 text-[3.25rem] font-semibold leading-none tracking-[-0.05em] tabular-nums">
                  <CountUp value={`+${formatNumber(weekExecution)}`} duration={1400} />
                </p>
                <BarsMini values={weekDays.map((d) => d.execution)} className="mt-5 h-20" />
              </div>
              <div className="mt-3 animate-row-in rounded-[18px] bg-white p-5 [animation-delay:400ms]">
                <FormulaGrid formulas={formulas} />
              </div>
            </PlayOnView>
          </Reveal>
        </div>
      </section>

      {/* Proof band */}
      <section aria-labelledby="proof-title" className="bg-[#F5F5F5] py-20 sm:py-28">
        <div className={container}>
          <Reveal variant="scale" className="flex flex-col items-center text-center">
            <h2 id="proof-title" className={`${h2} max-w-[18ch]`}>
              Built in the open. Tested like it matters.
            </h2>
            <Button asChild variant="light-secondary" size="md" className="group mt-8 h-11 rounded-full bg-[#E8E8E8] px-5 text-[15px] font-semibold hover:bg-[#DEDEDE]">
              <a href={REPO} target="_blank" rel="noopener noreferrer">
                Source on GitHub <ArrowRight aria-hidden="true" className="mi-arrow ml-1.5 size-4" />
              </a>
            </Button>
          </Reveal>
          <PlayOnView className="mt-14">
            <Reveal as="ul" variant="group" className="grid gap-4 md:grid-cols-3">
              {proof.map(({ label, icon: Icon, value, text }) => (
                <li key={label} className="card-live group/proof flex min-h-[18rem] flex-col justify-between rounded-[28px] bg-white p-8 sm:min-h-[22rem]">
                  <div className="flex items-start justify-between gap-4">
                    <p className="card-label text-[clamp(1.75rem,2.6vw,2.25rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-accent">{label}</p>
                    <Icon aria-hidden="true" className="size-9 shrink-0 text-accent transition-transform duration-500 group-hover/proof:rotate-[-12deg] group-hover/proof:scale-125" strokeWidth={1.75} />
                  </div>
                  <p className="card-art">
                    <span className="block text-[clamp(3.5rem,6vw,5rem)] font-semibold leading-none tracking-[-0.06em] tabular-nums">
                      <CountUp value={value} duration={1300} />
                    </span>
                    <span className="mt-3 block text-[1.375rem] font-semibold leading-[1.2] tracking-[-0.03em]">{text}</span>
                  </p>
                </li>
              ))}
            </Reveal>
          </PlayOnView>

          <Reveal as="figure" variant="up" className="mt-28 grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <Quote aria-hidden="true" className="size-10 -scale-x-100 fill-[#0A0A0A] text-[#0A0A0A]" strokeWidth={0} />
              <blockquote className={`${heading} mt-8 max-w-[24ch] text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.12]`}>
                <Words text="Every to-do app I tried counted what I planned. I wanted one that counted what I finished, and showed me the math." />
              </blockquote>
            </div>
            <figcaption className="flex items-center gap-4 lg:pb-2">
              <span aria-hidden="true" className="relative grid size-14 place-items-center rounded-full bg-[#0A0A0A] text-lg font-semibold tracking-[-0.02em] text-white">
                PP
                <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full border-2 border-[#F5F5F5] bg-accent" />
              </span>
              <span>
                <span className="block text-[17px] font-medium" translate="no">
                  {AUTHOR}
                </span>
                <span className={`block text-[15px] ${muted}`}>Creator of State</span>
              </span>
            </figcaption>
          </Reveal>
        </div>
      </section>

      {/* Compare promo: real logos drifting up and down on both sides */}
      <section aria-labelledby="compare-title" className="relative overflow-hidden bg-[#F5F5F5] pb-28 pt-12 sm:pb-36">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-[max(0.5rem,calc(50%-36rem))] hidden gap-3 lg:flex">
          <LogoColumn names={fill(left)} duration={26} />
          <LogoColumn names={fill(left, 2)} reverse duration={32} offset />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-[max(0.5rem,calc(50%-36rem))] hidden gap-3 lg:flex">
          <LogoColumn names={fill(right, 1)} reverse duration={30} offset />
          <LogoColumn names={fill(right)} duration={24} />
        </div>
        <div aria-hidden="true" className="mb-10 lg:hidden">
          <Marquee label="Compared tools" duration={22} controls={false}>
            {fill(tools).map((n, i) => (
              <BrandTile key={`${n}-${i}`} name={n} className="mx-2 size-16" />
            ))}
          </Marquee>
        </div>
        <Reveal variant="scale" className={`${container} relative flex flex-col items-center py-10 text-center lg:py-24`}>
          <h2 id="compare-title" className={`${h2} max-w-[18ch]`}>
            <span className="text-[#A1A1AA]">Comparing tools?</span>
            <br />
            See State vs the rest.
          </h2>
          <p className={`mt-5 max-w-[42ch] text-[15px] ${muted}`}>
            {tools.slice(0, -1).join(", ")} and {tools.at(-1)}, side by side.
          </p>
          <Button asChild variant="light-cta" size="md" className="group mt-8 h-11 rounded-full px-5 text-[15px]">
            <Link href="/compare">
              Compare <ArrowRight aria-hidden="true" className="mi-arrow ml-1.5 size-4" />
            </Link>
          </Button>
          <p className="mt-6 max-w-[48ch] text-[12px] text-[#71717A]">Logos are trademarks of their owners, shown only to name them.</p>
        </Reveal>
      </section>

      {/* Closing call to action */}
      <Reveal as="section" variant="none" aria-labelledby="cta-title" className={`${container} flex flex-col items-center py-28 text-center sm:py-40`}>
        <h2 id="cta-title" className={`${heading} text-[clamp(2.4rem,6vw,4.75rem)] leading-[1.04]`}>
          <Words text="Plan it. Do it." />
          <br />
          <Words text="Measure it." start={4} />
        </h2>
        <p className={`mt-5 max-w-[42ch] animate-fade-in text-[15px] leading-relaxed [animation-delay:500ms] ${muted}`}>{BYLINE}. Open the demo; nothing you enter is kept.</p>
        <div className="mt-8 animate-fade-in [animation-delay:700ms]">
          <PrimaryButtons secondary={{ href: REPO, label: "Source on GitHub", external: true }} />
        </div>
      </Reveal>
    </>
  );
}

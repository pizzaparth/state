import * as React from "react";
import type { Route, Viewport } from "next";
import Link from "next/link";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ParallaxBackdrop } from "@/components/motion/parallax";
import { Magnetic, MagneticLabel } from "@/components/marketing/magnetic";
import { Reveal } from "@/components/motion/reveal";
import { ScrollProgress } from "@/components/motion/scroll-progress";
import { AUTHOR, BYLINE } from "@/lib/site";

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

const REPO = "https://github.com/pizzaparth/state";
const navLink = "mi-underline inline-flex min-h-9 items-center text-[15px] font-medium transition-colors hover:text-[#52525B]";
const footLink = "w-fit text-[15px] text-white transition-colors hover:text-[#A1A1AA]";

const FOOTER = [
  {
    title: "Product",
    links: [
      { href: "/#loop", label: "How it works" },
      { href: "/demo", label: "Take a demo" },
      { href: "/login", label: "Owner sign in" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/principles", label: "Principles" },
      { href: "/compare", label: "Compare" },
    ],
  },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-white text-[#0A0A0A] selection:bg-accent selection:text-accent-ink">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-[#0A0A0A] focus:px-4 focus:py-2 focus:text-base focus:text-white"
      >
        Skip to content
      </a>

      <ParallaxBackdrop tone="light" />

      <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <nav aria-label="Main" className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-6 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-xl font-semibold tracking-[-0.05em]" translate="no">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-accent" />
            State
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <Link href="/#loop" className={navLink}>
              Product
            </Link>
            <Link href="/principles" className={navLink}>
              Principles
            </Link>
            <Link href="/compare" className={navLink}>
              Compare
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <a href={REPO} target="_blank" rel="noopener noreferrer" aria-label="Source on GitHub" className="hidden size-10 place-items-center rounded-full transition-colors hover:bg-black/[0.04] sm:grid">
              <Github className="size-[18px]" aria-hidden="true" />
            </a>
            <span aria-hidden="true" className="mx-2 hidden h-5 w-px bg-black/[0.1] sm:block" />
            <Link href="/login" className={`${navLink} mx-3`}>
              Sign in
            </Link>
            <Magnetic strength={0.3} radius={70}>
              <Button asChild variant="light-cta" size="sm" className="h-10 rounded-full px-5 text-[15px]">
                <Link href="/demo" prefetch={false}>
                  <MagneticLabel>Take a demo</MagneticLabel>
                </Link>
              </Button>
            </Magnetic>
          </div>
        </nav>
        <ScrollProgress />
      </header>

      <main id="content" className="relative z-10">
        {children}
      </main>

      {/* Footer fills the whole screen; the wordmark rises letter by letter */}
      <footer className="relative z-10 flex min-h-[100svh] flex-col overflow-hidden bg-[#111111] pt-20 text-white sm:pt-28">
        <Reveal className="mx-auto grid w-full max-w-[1120px] gap-12 px-5 sm:px-8 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-3">
            <Link href="/" className="text-3xl font-semibold tracking-[-0.05em]" translate="no">
              State
            </Link>
            <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#FF5C99]">{BYLINE}</p>
          </div>
          <div className="grid grid-cols-2 gap-12 sm:gap-20">
            {FOOTER.map((col) => (
              <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3">
                <p className="text-sm text-[#A1A1AA]">{col.title}</p>
                {col.links.map((l) => (
                  <Link key={l.href} href={l.href as Route} prefetch={l.href === "/demo" ? false : undefined} className={footLink}>
                    {l.label}
                  </Link>
                ))}
              </nav>
            ))}
          </div>
        </Reveal>
        <div className="mx-auto mt-16 flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-4 px-5 text-sm text-[#A1A1AA] sm:px-8">
          <p>
            © {new Date().getFullYear()} <span translate="no">{AUTHOR}</span>. Figures on this site are sample data.
          </p>
          <a href={REPO} target="_blank" rel="noopener noreferrer" aria-label="Source on GitHub" className="grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10 hover:text-white">
            <Github className="size-[18px]" aria-hidden="true" />
          </a>
        </div>
        {/* Giant cropped wordmark */}
        <Reveal variant="none" aria-hidden="true" className="mt-auto select-none overflow-hidden pt-10">
          <p className="whitespace-nowrap text-center text-[32vw] font-semibold leading-[0.72] tracking-[-0.07em] text-[#1C1C1C] [margin-bottom:-0.12em]" translate="no">
            {"State".split("").map((ch, i) => (
              <span key={i} className="letter-rise transition-colors duration-500 hover:text-[#2A2A2A]" style={{ "--l": i } as React.CSSProperties}>
                {ch}
              </span>
            ))}
          </p>
        </Reveal>
      </footer>
    </div>
  );
}

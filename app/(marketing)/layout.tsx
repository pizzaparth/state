import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ParticleField } from "@/components/marketing/particle-field";
import { ParallaxBackdrop } from "@/components/motion/parallax";
import { Magnetic, MagneticLabel } from "@/components/marketing/magnetic";
import { AUTHOR, BYLINE } from "@/lib/site";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`dark relative min-h-screen bg-[#001A33] text-[#FFFFFF] selection:bg-accent selection:text-accent-ink`}
    >
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-base focus:text-accent-ink"
      >
        Skip to content
      </a>

      <ParallaxBackdrop />
      <ParticleField />

      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <nav
          aria-label="Main"
          className="flex h-12 w-full max-w-[44rem] items-center justify-between gap-2 rounded-full border border-white/[0.12] bg-[#05223F]/85 pl-5 pr-1.5 backdrop-blur-md"
        >
          <Link href="/" className="font-display text-base font-extrabold uppercase tracking-[-0.01em] [font-stretch:125%]" translate="no">
            State
          </Link>
          <div className="hidden items-center gap-6 text-base text-[#B4BEDB] sm:flex">
            <Link href="/#history" className="mi-underline transition-colors hover:text-white">
              Product
            </Link>
            <Link href="/principles" className="mi-underline transition-colors hover:text-white">
              Principles
            </Link>
            <Link href="/compare" className="mi-underline transition-colors hover:text-white">
              Compare
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/login" className="mi-underline mx-3 inline-flex min-h-9 items-center text-base text-[#B4BEDB] transition-colors hover:text-white">
              Sign in
            </Link>
            <Magnetic strength={0.3} radius={70}>
              <Button asChild variant="dark-cta" size="sm" className="h-9 rounded-full px-4 text-sm">
                <Link href="/demo" prefetch={false}>
                  <MagneticLabel>Take a demo</MagneticLabel>
                </Link>
              </Button>
            </Magnetic>
          </div>
        </nav>
      </header>

      <main id="content" className="relative z-10">
        {children}
      </main>

      <footer className="relative z-10 border-t border-white/[0.1] bg-[#05223F]/85 backdrop-blur-md px-5 py-12 text-base text-[#8E9AC0] sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-[1320px] gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16">
          <div className="space-y-3">
            <p className="font-mono text-sm uppercase tracking-[0.18em] text-accent">{BYLINE}</p>
            <p>
              <span className="font-semibold text-[#FFFFFF]" translate="no">State</span> is built and used by{" "}
              <span className="text-[#FFFFFF]" translate="no">
                {AUTHOR}
              </span>
              . No ads, no AI, no payments.
            </p>
            <p className="max-w-[56ch] text-sm leading-relaxed">
              Graphs, histories and figures on this site are sample data. The demo keeps nothing: its workspace is deleted when you sign out or
              close the tab.
            </p>
            <p className="text-sm">
              © {new Date().getFullYear()} <span translate="no">{AUTHOR}</span>
            </p>
          </div>
          <nav aria-label="Site" className="flex flex-col gap-2">
            <Link href="/compare" className="mi-underline transition-colors hover:text-white">
              Compare
            </Link>
            <Link href="/principles" className="mi-underline transition-colors hover:text-white">
              Principles
            </Link>
            <Link href="/demo" prefetch={false} className="mi-underline transition-colors hover:text-white">
              Take a demo
            </Link>
            <Link href="/login" className="mi-underline transition-colors hover:text-white">
              Owner sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

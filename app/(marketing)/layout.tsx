import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ParticleField } from "@/components/marketing/particle-field";
import { Magnetic, MagneticLabel } from "@/components/marketing/magnetic";
import { LEGAL_PAGES } from "@/lib/legal";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`dark relative min-h-screen bg-[#050505] text-[#F4F4F2] selection:bg-white selection:text-black`}
    >
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-[#F1F1EE] focus:px-4 focus:py-2 focus:text-base focus:text-[#090909]"
      >
        Skip to content
      </a>

      <ParticleField />

      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <nav
          aria-label="Main"
          className="flex h-12 w-full max-w-[44rem] items-center justify-between gap-2 rounded-full border border-white/[0.1] bg-[#050505]/70 pl-5 pr-1.5 backdrop-blur-md"
        >
          <Link href="/home" className="font-display text-base font-extrabold uppercase tracking-[-0.01em] [font-stretch:125%]" translate="no">
            State
          </Link>
          <div className="hidden items-center gap-6 text-base text-[#A9A9A6] sm:flex">
            <Link href="/home#history" className="transition-colors hover:text-white">
              Product
            </Link>
            <Link href="/principles" className="transition-colors hover:text-white">
              Principles
            </Link>
            <Link href="/pricing" className="transition-colors hover:text-white">
              Pricing
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/login" className="px-3 py-2 text-base text-[#A9A9A6] transition-colors hover:text-white">
              Sign in
            </Link>
            <Magnetic strength={0.3} radius={70}>
              <Button asChild variant="dark-cta" size="sm" className="h-9 rounded-full px-4 text-sm">
                <Link href="/register">
                  <MagneticLabel>Subscribe</MagneticLabel>
                </Link>
              </Button>
            </Magnetic>
          </div>
        </nav>
      </header>

      <main id="content" className="relative z-10">
        {children}
      </main>

      <footer className="relative z-10 border-t border-white/[0.08] px-5 py-12 text-base text-[#6F6F6B] sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-[1320px] gap-10 md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-16">
          <div className="space-y-3">
            <p>
              <span className="font-semibold text-[#A9A9A6]" translate="no">State</span> is built by{" "}
              <span translate="no">Ksan&nbsp;Relay</span>. No ads, no AI, no surveillance.
            </p>
            <p className="max-w-[56ch] text-sm leading-relaxed">
              Graphs, histories and figures on this site are illustrative sample data. State’s metrics describe recorded work, not people,
              and are not intended for employment decisions.{" "}
              <Link href="/legal/disclaimer" className="underline underline-offset-4 transition-colors hover:text-white">
                Read the disclaimer
              </Link>
              .
            </p>
            <p className="text-sm">© {new Date().getFullYear()} Ksan&nbsp;Relay</p>
          </div>
          <nav aria-label="Product" className="flex flex-col gap-2">
            <Link href="/principles" className="transition-colors hover:text-white">
              Principles
            </Link>
            <Link href="/pricing" className="transition-colors hover:text-white">
              Pricing
            </Link>
            <Link href="/login" className="transition-colors hover:text-white">
              Sign in
            </Link>
          </nav>
          <nav aria-label="Legal" className="flex flex-col gap-2">
            {LEGAL_PAGES.map((page) => (
              <Link key={page.href} href={page.href} className="transition-colors hover:text-white">
                {page.title}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

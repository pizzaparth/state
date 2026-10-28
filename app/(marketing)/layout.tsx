import * as React from "react";
import Link from "next/link";
import { Archivo } from "next/font/google";
import { Button } from "@/components/ui/button";
import { ParticleField } from "@/components/marketing/particle-field";

// Expanded grotesk for display type; the wdth axis drives font-stretch
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${archivo.variable} dark relative min-h-screen bg-[#050505] text-[#F4F4F2] selection:bg-white selection:text-black`}
    >
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-[#F1F1EE] focus:px-4 focus:py-2 focus:text-sm focus:text-[#090909]"
      >
        Skip to content
      </a>

      <ParticleField />

      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <nav
          aria-label="Main"
          className="flex h-12 w-full max-w-[44rem] items-center justify-between gap-2 rounded-full border border-white/[0.1] bg-[#050505]/70 pl-5 pr-1.5 backdrop-blur-md"
        >
          <Link href="/" className="font-display text-sm font-extrabold uppercase tracking-[-0.01em] [font-stretch:125%]" translate="no">
            State
          </Link>
          <div className="hidden items-center gap-6 text-sm text-[#A9A9A6] sm:flex">
            <Link href="/#how-it-works" className="transition-colors hover:text-white">
              How it works
            </Link>
            <Link href="/principles" className="transition-colors hover:text-white">
              Principles
            </Link>
            <Link href="/pricing" className="transition-colors hover:text-white">
              Pricing
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/login" className="px-3 py-2 text-sm text-[#A9A9A6] transition-colors hover:text-white">
              Sign in
            </Link>
            <Button asChild variant="dark-cta" size="sm" className="h-9 rounded-full px-4">
              <Link href="/register">Subscribe</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main id="content" className="relative z-10">
        {children}
      </main>

      <footer className="relative z-10 border-t border-white/[0.08] px-5 py-12 text-sm text-[#6F6F6B] sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1320px] flex-col justify-between gap-6 md:flex-row md:items-center">
          <p>
            <span className="font-semibold text-[#A9A9A6]" translate="no">State</span> is built by{" "}
            <span translate="no">Ksan&nbsp;Relay</span>. No ads, no AI, no surveillance.
          </p>
          <div className="flex gap-6">
            <Link href="/principles" className="transition-colors hover:text-white">
              Principles
            </Link>
            <Link href="/pricing" className="transition-colors hover:text-white">
              Pricing
            </Link>
            <Link href="/login" className="transition-colors hover:text-white">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

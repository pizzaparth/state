import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark min-h-screen bg-[#050505] text-[#F4F4F2] flex flex-col justify-between selection:bg-white selection:text-black">
      {/* Marketing Navigation */}
      <header className="border-b border-white/[0.08] sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white">
            <span className="font-bold tracking-display text-lg text-[#F4F4F2]">
              STATE
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8 text-sm text-[#A9A9A6]" aria-label="Marketing Navigation">
            <Link href="/principles" className="hover:text-white transition-colors">
              Principles
            </Link>
            <Link href="/pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
          </nav>

          <div className="flex items-center space-x-4">
            <Link href="/login" className="text-sm text-[#A9A9A6] hover:text-white transition-colors">
              Sign in
            </Link>
            <Button asChild variant="dark-cta" size="sm">
              <Link href="/register">Start State</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Marketing Surface */}
      <main className="flex-1">{children}</main>

      {/* Marketing Footer */}
      <footer className="border-t border-white/[0.08] py-12 px-6 text-xs text-[#6F6F6B]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-[#A9A9A6]">State</span>
            <span>—</span>
            <span>A quantitative execution system by Ksan Relay</span>
          </div>
          <div className="flex space-x-6">
            <Link href="/principles" className="hover:text-white transition-colors">
              Principles
            </Link>
            <Link href="/pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/login" className="hover:text-white transition-colors">
              App
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

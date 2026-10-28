import * as React from "react";
import Link from "next/link";
import { LEGAL_PAGES } from "@/lib/legal";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark min-h-screen bg-[#050505] text-[#F4F4F2] flex flex-col justify-between p-6">
      <header className="max-w-md mx-auto w-full pt-8 text-center">
        <Link href="/" className="inline-block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white">
          <span className="text-xs font-semibold tracking-eyebrow text-[#6F6F6B] uppercase block">
            Ksan Relay
          </span>
          <span className="text-2xl font-bold tracking-display text-[#F4F4F2]">
            STATE
          </span>
        </Link>
      </header>

      <main className="max-w-md mx-auto w-full my-auto py-8">
        <div className="bg-[#0A0A0A] border border-white/[0.1] rounded-card p-8 shadow-dark-card">
          {children}
        </div>
      </main>

      <footer className="pb-8 text-center text-xs text-[#6F6F6B]">
        <nav aria-label="Legal" className="mb-3 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {LEGAL_PAGES.map((page) => (
            <Link key={page.href} href={page.href} className="transition-colors hover:text-white">
              {page.title}
            </Link>
          ))}
        </nav>
        <span>© {new Date().getFullYear()} Ksan&nbsp;Relay</span>
      </footer>
    </div>
  );
}

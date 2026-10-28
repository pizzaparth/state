import * as React from "react";
import Link from "next/link";

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

      <footer className="text-center pb-8 text-xs text-[#6F6F6B]">
        <span>© {new Date().getFullYear()} Ksan Relay. All rights reserved.</span>
      </footer>
    </div>
  );
}

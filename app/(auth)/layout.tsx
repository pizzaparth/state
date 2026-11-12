import * as React from "react";
import Link from "next/link";
import { AUTHOR, BYLINE } from "@/lib/site";
import { DISPLAY } from "@/lib/type";
import { ParallaxBackdrop } from "@/components/motion/parallax";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-[#0A0A0A] flex flex-col justify-between p-6">
      <ParallaxBackdrop tone="light" />
      <header className="relative z-10 max-w-md mx-auto w-full pt-8 text-center">
        <Link href="/" className="inline-block rounded-[8px]">
          <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-accent" translate="no">{AUTHOR}</span>
          <span className={`${DISPLAY} block text-3xl leading-none text-[#0A0A0A]`}>State</span>
        </Link>
      </header>

      <main className="relative z-10 max-w-md mx-auto w-full my-auto py-8">
        <div className="rounded-[28px] bg-[#F5F5F5]/90 p-6 backdrop-blur-sm sm:p-8">{children}</div>
      </main>

      <footer className="relative z-10 pb-8 text-center text-xs text-[#71717A]">
        <span>{BYLINE}</span>
      </footer>
    </div>
  );
}

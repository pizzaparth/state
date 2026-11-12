import Link from "next/link";
import type { Metadata } from "next";
import { OwnerCodeForm } from "@/components/auth/owner-code-form";
import { isSafeRedirectPath } from "@/lib/auth/redirect";
import { DISPLAY } from "@/lib/type";

export const metadata: Metadata = { title: "Owner sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const redirectTo = isSafeRedirectPath(next) && next.startsWith("/platform") ? next : "/platform/today";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className={`${DISPLAY} text-[2rem] leading-[0.95] text-[#0A0A0A] text-balance`}>Owner sign in</h1>
        <p className="font-mono text-sm text-[#52525B]">One account. Ends when the browser closes.</p>
      </div>

      <OwnerCodeForm redirectTo={redirectTo} />

      <p className="pt-2 text-center text-sm text-[#52525B]">
        Just looking?{" "}
        <Link href="/demo" prefetch={false} className="font-medium text-accent hover:underline">
          Take a demo
        </Link>
      </p>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { SentNotice } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { isSafeRedirectPath } from "@/lib/auth/redirect";
import { getSession } from "@/lib/auth/session";
import { DISPLAY } from "@/lib/type";

export const metadata = { title: "Verify email — State" };

// Landing page for the emailed verification link. Better Auth verifies the token at
// /api/auth/verify-email, signs the user in and redirects here, adding ?error=… on failure.
// Success continues to `next` at once; only failures render.
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const session = await getSession();
  const continueTo = isSafeRedirectPath(next) ? next : "/subscribe";

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className={`${DISPLAY} text-[2rem] leading-[0.95] text-[#F4F4F2] text-balance`}>Link expired</h1>
        <SentNotice title="Get a new link">
          <p>Links last 24 hours. Sign in and we’ll send a fresh one.</p>
        </SentNotice>
        <Button asChild variant="dark-cta" size="md" className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  // A link opened a second time verifies nothing and signs nobody in
  if (!session?.user.emailVerified) {
    return (
      <div className="space-y-6">
        <h1 className={`${DISPLAY} text-[2rem] leading-[0.95] text-[#F4F4F2] text-balance`}>Already verified</h1>
        <p className="text-sm text-[#A9A9A6]">Link used. Sign in to continue.</p>
        <Button asChild variant="dark-cta" size="md" className="w-full">
          <Link href={`/login?next=${encodeURIComponent(continueTo)}` as Route}>Sign in</Link>
        </Button>
      </div>
    );
  }

  // Verified and signed in: go straight on (fresh verification, or a sign-in that
  // carried the same callback)
  redirect(continueTo as Route);
}

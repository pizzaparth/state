import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { SentNotice } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { isSafeRedirectPath } from "@/lib/auth/redirect";
import { getSession } from "@/lib/auth/session";

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
        <h1 className="text-xl font-bold tracking-tight text-[#F4F4F2]">Verification link expired</h1>
        <SentNotice title="Get a new link">
          <p>Verification links expire after 24 hours. Sign in with your email and password and we will send a fresh one.</p>
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
        <h1 className="text-xl font-bold tracking-tight text-[#F4F4F2]">Email already verified</h1>
        <p className="text-sm text-[#A9A9A6]">This link has been used. Sign in to continue.</p>
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

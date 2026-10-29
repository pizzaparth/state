import Link from "next/link";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { isSafeRedirectPath } from "@/lib/auth/redirect";
import { DISPLAY } from "@/lib/type";

export const metadata = { title: "Sign in — State" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  const redirectTo = isSafeRedirectPath(next) ? next : "/platform/today";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className={`${DISPLAY} text-[2rem] leading-[0.95] text-[#F4F4F2] text-balance`}>Sign in</h1>
      </div>

      {reset === "1" && (
        <p role="status" className="rounded-input border border-white/[0.1] bg-[#151515] px-4 py-3 text-sm text-[#F4F4F2]">
          Password changed. Other devices signed out.
        </p>
      )}

      <CredentialsForm mode="sign-in" redirectTo={redirectTo} />

      <div className="pt-2 text-center text-sm text-[#A9A9A6]">
        <span>New here? </span>
        <Link href="/register" className="text-white hover:underline font-medium">
          Create account
        </Link>
      </div>
    </div>
  );
}

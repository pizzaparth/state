import Link from "next/link";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { isSafeRedirectPath } from "@/lib/auth/redirect";

export const metadata = { title: "Sign in — State" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const redirectTo = isSafeRedirectPath(next) ? next : "/today";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-[#F4F4F2]">Sign in to State</h1>
        <p className="text-xs text-[#A9A9A6]">Enter your credentials to open your workspace.</p>
      </div>

      <CredentialsForm mode="sign-in" redirectTo={redirectTo} />

      <div className="pt-2 text-center text-xs text-[#A9A9A6]">
        <span>Don’t have an account? </span>
        <Link href="/register" className="text-white hover:underline font-medium">
          Create account
        </Link>
      </div>
    </div>
  );
}

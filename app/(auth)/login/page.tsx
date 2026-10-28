import Link from "next/link";
import { CredentialsForm } from "@/components/auth/credentials-form";

export const metadata = { title: "Sign in — State" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Only allow same-site relative paths to avoid open redirects
  const redirectTo = next && next.startsWith("/") && !next.startsWith("//") ? next : "/today";

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

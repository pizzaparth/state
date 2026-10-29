import Link from "next/link";
import { CredentialsForm } from "@/components/auth/credentials-form";
import { DISPLAY } from "@/lib/type";

export const metadata = { title: "Create account — State" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string }>;
}) {
  const { plan, interval } = await searchParams;
  const query = new URLSearchParams();
  if (plan === "individual" || plan === "organisation") query.set("plan", plan);
  if (interval === "monthly" || interval === "yearly") query.set("interval", interval);
  const redirectTo = `/subscribe${query.size ? `?${query}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className={`${DISPLAY} text-[2rem] leading-[0.95] text-[#F4F4F2] text-balance`}>Create account</h1>
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-[#A9A9A6]">Step 1/2 · verify email → pick plan</p>
      </div>

      <CredentialsForm mode="sign-up" redirectTo={redirectTo} />

      <p className="text-center text-[11px] leading-relaxed text-[#6F6F6B]">
        You agree to the{" "}
        <Link href="/legal/terms" className="text-[#A9A9A6] underline underline-offset-2 hover:text-white">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="text-[#A9A9A6] underline underline-offset-2 hover:text-white">
          privacy policy
        </Link>
        .
      </p>

      <div className="pt-2 text-center text-sm text-[#A9A9A6]">
        <span>Have an account? </span>
        <Link href="/login" className="text-white hover:underline font-medium">
          Sign in
        </Link>
      </div>
    </div>
  );
}

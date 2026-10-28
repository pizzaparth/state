import Link from "next/link";
import { CredentialsForm } from "@/components/auth/credentials-form";

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
        <h1 className="text-xl font-bold tracking-tight text-[#F4F4F2]">Create your State account</h1>
        <p className="text-xs text-[#A9A9A6]">Step 1 of 2. Next you choose a plan and pay; your workspace opens right after.</p>
      </div>

      <CredentialsForm mode="sign-up" redirectTo={redirectTo} />

      <div className="pt-2 text-center text-xs text-[#A9A9A6]">
        <span>Already have an account? </span>
        <Link href="/login" className="text-white hover:underline font-medium">
          Sign in
        </Link>
      </div>
    </div>
  );
}

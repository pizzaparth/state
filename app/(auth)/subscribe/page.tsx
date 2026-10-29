import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPaidAccess } from "@/lib/billing/access";
import { PLANS } from "@/lib/billing/plans";
import { paymentSkipEnabled } from "@/lib/billing/skip";
import { DISPLAY } from "@/lib/type";
import { SubscribeForm } from "./subscribe-form";

export const metadata = { title: "Subscribe — State" };

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string; canceled?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/register");
  if (await hasPaidAccess(session.user.id)) redirect("/today");

  const { plan, interval, canceled } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className={`${DISPLAY} text-[2rem] leading-[0.95] text-[#F4F4F2] text-balance`}>Pick a plan</h1>
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-[#A9A9A6]">Step 2/2 · cancel anytime · data stays yours</p>
      </div>
      {canceled && (
        <p role="status" className="text-sm text-[#A9A9A6] border-l-2 border-white/20 pl-3">
          Checkout cancelled. Nothing charged.
        </p>
      )}
      <SubscribeForm
        plans={Object.values(PLANS)}
        initialPlan={plan === "organisation" ? "organisation" : "individual"}
        initialInterval={interval === "yearly" ? "yearly" : "monthly"}
        canSkip={paymentSkipEnabled()}
      />
    </div>
  );
}

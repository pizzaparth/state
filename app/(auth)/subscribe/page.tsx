import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPaidAccess } from "@/lib/billing/access";
import { PLANS } from "@/lib/billing/plans";
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
        <h1 className="text-xl font-bold tracking-tight text-[#F4F4F2]">Choose your plan</h1>
        <p className="text-xs text-[#A9A9A6] text-pretty">
          State is paid from day one. Your workspace is created as soon as payment clears. Cancel anytime; your data stays exportable.
        </p>
      </div>
      {canceled && (
        <p role="status" className="text-xs text-[#A9A9A6] border-l-2 border-white/20 pl-3">
          Checkout was cancelled. No payment was taken.
        </p>
      )}
      <SubscribeForm
        plans={Object.values(PLANS)}
        initialPlan={plan === "organisation" ? "organisation" : "individual"}
        initialInterval={interval === "yearly" ? "yearly" : "monthly"}
      />
    </div>
  );
}

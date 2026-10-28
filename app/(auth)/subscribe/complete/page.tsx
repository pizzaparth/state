import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { hasPaidAccess } from "@/lib/billing/access";
import { RefreshUntilActive } from "./refresh";

export const metadata = { title: "Confirming payment — State" };

// Landing page after checkout. The webhook usually arrives within seconds; until then
// the page re-checks access and forwards to Today once the subscription is active.
export default async function SubscribeCompletePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (await hasPaidAccess(session.user.id)) redirect("/today");

  return (
    <div className="space-y-4" aria-live="polite">
      <h1 className="text-xl font-bold tracking-tight text-[#F4F4F2]">Confirming payment…</h1>
      <p className="text-xs text-[#A9A9A6]">
        Your workspace opens automatically once the payment provider confirms. This usually takes a few seconds.
      </p>
      <p className="text-xs text-[#6F6F6B]">
        Nothing after a minute?{" "}
        <Link href="/subscribe" className="text-white underline-offset-2 hover:underline">
          Return to plans
        </Link>
        . You will not be charged twice.
      </p>
      <RefreshUntilActive />
    </div>
  );
}

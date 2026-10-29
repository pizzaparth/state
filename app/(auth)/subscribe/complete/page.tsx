import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { hasPaidAccess } from "@/lib/billing/access";
import { DISPLAY } from "@/lib/type";
import { RefreshUntilActive } from "./refresh";

export const metadata = { title: "Confirming payment", robots: { index: false } };

// Landing page after checkout. The webhook usually arrives within seconds; until then
// the page re-checks access and forwards to Today once the subscription is active.
export default async function SubscribeCompletePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (await hasPaidAccess(session.user.id)) redirect("/platform/today");

  return (
    <div className="space-y-4" aria-live="polite">
      <h1 className={`${DISPLAY} text-[2rem] leading-[0.95] text-[#F4F4F2] text-balance`}>Confirming…</h1>
      <p className="text-sm text-[#A9A9A6]">
        Workspace opens once payment clears. Usually seconds.
      </p>
      <p className="text-xs text-[#6F6F6B]">
        Nothing after a minute?{" "}
        <Link href="/subscribe" className="text-white underline-offset-2 hover:underline">
          Return to plans
        </Link>
        . No double charge.
      </p>
      <RefreshUntilActive />
    </div>
  );
}

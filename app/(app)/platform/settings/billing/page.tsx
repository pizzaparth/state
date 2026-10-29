import * as React from "react";
import { getPayments, getSubscription } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { PLANS, formatInr, type PlanId } from "@/lib/billing/plans";
import { Chip, PageHeader, Panel, EmptyState, TICK } from "@/components/app/primitives";
import { Row, SettingsNav } from "@/components/app/settings-nav";
import { RenewalControl } from "@/components/app/renewal-control";
import { cn } from "@/lib/utils";

export const metadata = { title: "Billing" };

// Periods longer than this are yearly plans
const YEARLY_AFTER_DAYS = 40;

export default async function BillingSettingsPage() {
  const viewer = await getViewer();
  const [sub, charges] = await Promise.all([getSubscription(viewer.id), getPayments(viewer.id)]);
  const plan = sub ? PLANS[sub.plan as PlanId] : null;
  const fullDate = { day: "numeric", month: "long", year: "numeric" } as const;

  const yearly =
    sub?.currentPeriodStart && sub.currentPeriodEnd
      ? sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime() > YEARLY_AFTER_DAYS * 86_400_000
      : false;
  const seats = plan?.perSeat ? sub!.seats : 1;
  const lastPaid = charges.find((c) => c.status === "paid");
  // The provider's last charge is what renews (currency included); before any, the list price
  const nextAmount = lastPaid ? formatMoney(lastPaid.amount, lastPaid.currency) : plan ? formatInr(plan.priceInr[yearly ? "yearly" : "monthly"] * seats) : null;
  const live = sub && ["active", "past_due"].includes(sub.status);
  const renewing = Boolean(live && !sub!.cancelAtPeriodEnd);
  const endsLabel = sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd, viewer.tz, { day: "numeric", month: "long" }) : null;

  return (
    <>
      <PageHeader label="Settings" title="Billing" />
      <SettingsNav active="/platform/settings/billing" />
      <Panel title="Subscription">
        {!sub || !plan ? (
          <EmptyState title="No plan yet" />
        ) : (
          <dl>
            <Row label="Plan">
              {plan.name}
              {plan.perSeat && <span className="text-[#9A9A96]"> for {formatNumber(sub.seats)} members</span>}
            </Row>
            <Row label="Status">
              <Chip>{sub.status.replace("_", " ")}</Chip>
            </Row>
            <Row label="Price" hint="yearly = 10 months for 12">
              {yearly
                ? `${formatInr(plan.priceInr.yearly * seats)}/yr`
                : `${formatInr(plan.priceInr.monthly * seats)}/mo`}
            </Row>
            <Row label="Period">
              {sub.currentPeriodStart && sub.currentPeriodEnd
                ? `${formatDate(sub.currentPeriodStart, viewer.tz, fullDate)} → ${formatDate(sub.currentPeriodEnd, viewer.tz, fullDate)}`
                : "—"}
            </Row>
            <Row label={renewing ? "Next charge" : "Access ends"}>
              {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd, viewer.tz, fullDate) : "—"}
              {renewing && nextAmount && <span className="text-[#9A9A96]"> · {nextAmount}</span>}
            </Row>
            <Row label="Renewal" hint={sub.provider === "razorpay" && renewing ? "Razorpay cancels can't be undone" : undefined}>
              <span className="mb-3 block">{renewing ? (yearly ? "Auto-renews yearly" : "Auto-renews monthly") : live ? "Ends at period end" : "Off"}</span>
              {live && <RenewalControl renewing={renewing} endsLabel={endsLabel} canResume={sub.provider !== "razorpay"} />}
            </Row>
            <Row label="Provider">{sub.provider === "razorpay" ? "Razorpay" : sub.provider === "stripe" ? "Stripe" : "Development"}</Row>
          </dl>
        )}
      </Panel>
      <Panel title="Charges" aside={charges.length > 0 ? `${charges.length}` : undefined}>
        {charges.length === 0 ? (
          <EmptyState title="No charges yet" />
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[32rem] text-left text-base tabular-nums">
              <thead>
                <tr className={cn(TICK, "text-[#9A9A96]")}>
                  <th scope="col" className="pb-2 font-normal">Date</th>
                  <th scope="col" className="pb-2 font-normal">Period</th>
                  <th scope="col" className="pb-2 text-right font-normal">Amount</th>
                  <th scope="col" className="pb-2 pl-4 font-normal">Status</th>
                  <th scope="col" className="pb-2 font-normal"><span className="sr-only">Receipt</span></th>
                </tr>
              </thead>
              <tbody>
                {charges.map((c) => (
                  <tr key={c.id} className="border-t border-white/[0.08]">
                    <td className="py-3">{formatDate(c.chargedAt, viewer.tz, { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="py-3 text-[#9A9A96]">
                      {c.periodStart && c.periodEnd
                        ? `${formatDate(c.periodStart, viewer.tz)} → ${formatDate(c.periodEnd, viewer.tz)}`
                        : "—"}
                    </td>
                    <td className="py-3 text-right font-mono">{formatMoney(c.amount, c.currency)}</td>
                    <td className="py-3 pl-4">
                      <Chip>{c.status === "paid" ? "Paid" : "Failed"}</Chip>
                    </td>
                    <td className="py-3 text-right">
                      {c.receiptUrl && (
                        <a href={c.receiptUrl} target="_blank" rel="noreferrer noopener" className="text-[#9A9A96] underline underline-offset-2 hover:text-[#F2F2EF]">
                          Receipt
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

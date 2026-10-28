import * as React from "react";
import { getSubscription } from "@/db/queries";
import { getViewer } from "@/lib/viewer";
import { formatDate, formatNumber } from "@/lib/format";
import { PLANS, formatInr, type PlanId } from "@/lib/billing/plans";
import { Chip, PageHeader, Panel, EmptyState } from "@/components/app/primitives";
import { Row, SettingsNav } from "@/components/app/settings-nav";

export const metadata = { title: "Billing — State" };

export default async function BillingSettingsPage() {
  const viewer = await getViewer();
  const sub = await getSubscription(viewer.id);
  const plan = sub ? PLANS[sub.plan as PlanId] : null;
  const fullDate = { day: "numeric", month: "long", year: "numeric" } as const;
  return (
    <>
      <PageHeader label="Settings" title="Billing" />
      <SettingsNav active="/settings/billing" />
      <Panel title="Subscription">
        {!sub || !plan ? (
          <EmptyState title="No subscription">Choose a plan to open your workspace.</EmptyState>
        ) : (
          <dl>
            <Row label="Plan">
              {plan.name}
              {plan.perSeat && <span className="text-[#5F5F5B]"> for {formatNumber(sub.seats)} members</span>}
            </Row>
            <Row label="Status">
              <Chip>{sub.status.replace("_", " ")}</Chip>
            </Row>
            <Row label="Price" hint="Monthly list price; yearly billing is ten months for twelve.">
              {formatInr(plan.priceInr.monthly * (plan.perSeat ? sub.seats : 1))} per month
            </Row>
            <Row label="Current period">
              {sub.currentPeriodStart && sub.currentPeriodEnd
                ? `${formatDate(sub.currentPeriodStart, viewer.tz, fullDate)} to ${formatDate(sub.currentPeriodEnd, viewer.tz, fullDate)}`
                : "—"}
            </Row>
            <Row label="Renewal">{sub.cancelAtPeriodEnd ? "Ends at period end" : "Renews automatically"}</Row>
            <Row label="Payment provider">{sub.provider === "razorpay" ? "Razorpay" : "Stripe"}</Row>
          </dl>
        )}
      </Panel>
    </>
  );
}

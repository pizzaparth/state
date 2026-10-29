import * as React from "react";
import { cn } from "@/lib/utils";
import { TICK } from "./primitives";
import { TabLinks } from "./tab-links";

const ITEMS = [
  { href: "/platform/settings/account", label: "Account" },
  { href: "/platform/settings/billing", label: "Billing" },
  { href: "/platform/settings/preferences", label: "Preferences" },
] as const;

export function SettingsNav({ active }: { active: (typeof ITEMS)[number]["href"] }) {
  return <TabLinks label="Settings sections" size="md" scroll items={ITEMS.map((item) => ({ ...item, active: item.href === active }))} />;
}

export function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1 border-t border-white/[0.08] py-3.5 first:border-t-0 first:pt-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6">
      <dt className={cn(TICK, "pt-1 text-[#9A9A96]")}>{label}</dt>
      <dd className="min-w-0 break-words text-base font-medium">
        {children}
        {hint && <span className="mt-0.5 block font-mono text-[12px] font-normal text-[#85857F]">{hint}</span>}
      </dd>
    </div>
  );
}

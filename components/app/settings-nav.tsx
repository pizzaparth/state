import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings/account", label: "Account" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/preferences", label: "Preferences" },
] as const;

export function SettingsNav({ active }: { active: (typeof ITEMS)[number]["href"] }) {
  return (
    <nav aria-label="Settings sections" className="app-field inline-flex rounded-[14px] p-1">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href as Route}
          aria-current={item.href === active ? "page" : undefined}
          className={cn(
            "rounded-[10px] px-4 py-2 text-sm font-medium transition-[background-color,box-shadow,color]",
            item.href === active ? "bg-white/[0.12] text-[#F2F2EF]" : "text-[#9A9A96] hover:text-[#F2F2EF]"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1 border-t border-white/[0.08] py-3.5 first:border-t-0 first:pt-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6">
      <dt className="text-sm text-[#9A9A96]">{label}</dt>
      <dd className="min-w-0 break-words text-sm">
        {children}
        {hint && <span className="mt-0.5 block text-xs text-[#85857F]">{hint}</span>}
      </dd>
    </div>
  );
}

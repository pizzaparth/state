import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import type { ViewerOrg } from "@/lib/viewer";
import { cn } from "@/lib/utils";
import { Chip } from "./primitives";

const TABS = [
  { key: "overview", label: "Overview", path: "" },
  { key: "board", label: "Board", path: "/board" },
  { key: "projects", label: "Projects", path: "/projects" },
  { key: "members", label: "Members", path: "/members" },
  { key: "metrics", label: "Metrics", path: "/metrics" },
] as const;

/** Organisation title plus section tabs (links, so every view deep-links). */
export function OrgHeader({ org, active, description }: { org: ViewerOrg; active: (typeof TABS)[number]["key"]; description?: string }) {
  return (
    <header className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5F5F5B]">Organisation</p>
          <h1 className="mt-1 text-[clamp(2rem,4vw,2.75rem)] font-bold leading-none tracking-[-0.03em]">{org.name}</h1>
          {description && <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-[#5F5F5B]">{description}</p>}
        </div>
        <Chip>Your role: {org.role}</Chip>
      </div>
      <nav aria-label={`${org.name} sections`} className="neu-inset-sm inline-flex max-w-full overflow-x-auto rounded-[14px] p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/org/${org.slug}${tab.path}` as Route}
            aria-current={tab.key === active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-[10px] px-4 py-2 text-sm font-medium transition-[background-color,box-shadow,color]",
              tab.key === active ? "neu-raised-sm bg-[#DEDEDA] text-[#171717]" : "text-[#5F5F5B] hover:text-[#171717]"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

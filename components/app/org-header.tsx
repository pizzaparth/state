import * as React from "react";
import type { ViewerOrg } from "@/lib/viewer";
import { cn } from "@/lib/utils";
import { Chip, DISPLAY, TICK } from "./primitives";
import { TabLinks } from "./tab-links";

const TABS = [
  { key: "overview", label: "Overview", path: "" },
  { key: "board", label: "Board", path: "/board" },
  { key: "projects", label: "Projects", path: "/platform/projects" },
  { key: "members", label: "Members", path: "/members" },
  { key: "metrics", label: "Metrics", path: "/platform/metrics" },
] as const;

/** Organisation title plus section tabs (links, so every view deep-links). */
export function OrgHeader({ org, active }: { org: ViewerOrg; active: (typeof TABS)[number]["key"] }) {
  return (
    <header className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className={cn(TICK, "text-[#9A9A96]")}>Team</p>
          <h1 className={cn(DISPLAY, "mt-2 break-words text-[clamp(2.25rem,6vw,4.25rem)] leading-[0.9] text-balance")}>{org.name}</h1>
        </div>
        <Chip>{org.role}</Chip>
      </div>
      <TabLinks
        label={`${org.name} sections`}
        size="md"
        scroll
        items={TABS.map((tab) => ({ href: `/platform/org/${org.slug}${tab.path}`, label: tab.label, active: tab.key === active }))}
      />
    </header>
  );
}

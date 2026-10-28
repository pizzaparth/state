import * as React from "react";
import type { ViewerOrg } from "@/lib/viewer";
import { Chip } from "./primitives";
import { TabLinks } from "./tab-links";

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
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A9A96]">Organisation</p>
          <h1 className="mt-1 text-[clamp(2rem,4vw,2.75rem)] font-bold leading-none tracking-[-0.03em]">{org.name}</h1>
          {description && <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-[#9A9A96]">{description}</p>}
        </div>
        <Chip>Your role: {org.role}</Chip>
      </div>
      <TabLinks
        label={`${org.name} sections`}
        size="md"
        scroll
        items={TABS.map((tab) => ({ href: `/org/${org.slug}${tab.path}`, label: tab.label, active: tab.key === active }))}
      />
    </header>
  );
}

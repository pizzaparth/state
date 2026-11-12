import * as React from "react";
import { siAsana, siClickup, siJira, siLinear, siNotion, siTodoist, siTrello, type SimpleIcon } from "simple-icons";
import { cn } from "@/lib/utils";

/**
 * App-icon tiles for the tools State is compared with, drawn from the Simple Icons set
 * (CC0 paths, each brand's own colour). Names are trademarks of their owners and are used
 * only to identify them. Decorative: the section text names every tool.
 */
const BRANDS: Record<string, { icon: SimpleIcon; tile: string; mark: string }> = {
  Notion: { icon: siNotion, tile: "#FFFFFF", mark: "#000000" },
  Trello: { icon: siTrello, tile: `#${siTrello.hex}`, mark: "#FFFFFF" },
  Todoist: { icon: siTodoist, tile: `#${siTodoist.hex}`, mark: "#FFFFFF" },
  Asana: { icon: siAsana, tile: "#FFFFFF", mark: `#${siAsana.hex}` },
  ClickUp: { icon: siClickup, tile: `#${siClickup.hex}`, mark: "#FFFFFF" },
  Jira: { icon: siJira, tile: `#${siJira.hex}`, mark: "#FFFFFF" },
  Linear: { icon: siLinear, tile: "#0A0A0A", mark: "#FFFFFF" },
};

export function BrandTile({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const brand = BRANDS[name];
  if (!brand) return null;
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-[24%] ring-1 ring-black/[0.06]", className)}
      style={{ backgroundColor: brand.tile, ...style }}
    >
      <svg viewBox="0 0 24 24" className="size-[52%]" fill={brand.mark}>
        <path d={brand.icon.path} />
      </svg>
    </span>
  );
}

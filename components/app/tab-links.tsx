"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { LayoutGroup, motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * URL-driven tabs / segmented control. The active indicator slides to the selected
 * item (shared layout animation, transform-only); links keep deep-linking and
 * Cmd/middle-click working.
 */
export function TabLinks({
  label,
  items,
  size = "sm",
  scroll = false,
}: {
  label: string;
  items: { href: string; label: string; active: boolean }[];
  size?: "sm" | "md";
  scroll?: boolean;
}) {
  const id = React.useId();
  return (
    <LayoutGroup id={id}>
      <nav aria-label={label} className={cn("app-field inline-flex max-w-full overflow-x-auto p-1", size === "md" ? "rounded-[14px]" : "rounded-[12px]")}>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href as Route}
            aria-current={item.active ? "page" : undefined}
            scroll={scroll}
            className={cn(
              "mi-press relative shrink-0 font-medium transition-colors duration-150",
              size === "md" ? "rounded-[10px] px-4 py-2 text-base" : "rounded-[9px] px-3 py-1.5 text-sm",
              item.active ? "font-semibold text-accent-ink" : "text-[#B4BEDB] hover:text-[#FFFFFF]"
            )}
          >
            {item.active && (
              <motion.span
                layoutId="tab-active"
                aria-hidden="true"
                className="absolute inset-0 rounded-[inherit] bg-accent"
                transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.8 }}
              />
            )}
            <span className="relative z-[1]">{item.label}</span>
          </Link>
        ))}
      </nav>
    </LayoutGroup>
  );
}

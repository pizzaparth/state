import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import type { DueState } from "@/lib/format";

/**
 * Product-surface primitives on the flat AMOLED surface scale (styles/product.css):
 *   Panel           #0A0A0A + hairline (columns, metric panels, toolbars)
 *   Field / Rail    #000 + stronger hairline (inputs, progress rails, segmented controls)
 *   Rows, labels    directly on the page, no surface
 */

export function PageHeader({
  label,
  title,
  description,
  actions,
}: {
  label?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {label && <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A9A96]">{label}</p>}
        <h1 className="mt-1 scroll-mt-24 text-[clamp(2rem,4vw,2.75rem)] font-bold leading-none tracking-[-0.03em] text-[#F2F2EF]">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-[#9A9A96]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Level 1 surface. */
export function Panel({
  title,
  aside,
  children,
  className,
  as: Tag = "section",
}: {
  title?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  as?: "section" | "div";
}) {
  return (
    <Tag className={cn("app-panel min-w-0 p-5", className)}>
      {(title || aside) && (
        <div className="mb-4 flex items-baseline justify-between gap-4">
          {title && <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A9A96]">{title}</h2>}
          {aside && <div className="text-xs text-[#85857F]">{aside}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

/** Level -1 progress rail with a graphite fill. */
export function ProgressRail({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="app-field h-2.5 w-full overflow-hidden rounded-full"
    >
      <div className="h-full origin-left rounded-full bg-[#F2F2EF] transition-transform duration-300" style={{ transform: `scaleX(${pct / 100})` }} />
    </div>
  );
}

/** URL-driven segmented control: an inset trough with a raised active segment. */
export function SegmentedLinks({ label, items }: { label: string; items: { href: string; label: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="app-field inline-flex rounded-[12px] p-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href as Route}
          aria-current={item.active ? "page" : undefined}
          scroll={false}
          className={cn(
            "rounded-[9px] px-3 py-1.5 text-xs font-medium transition-[background-color,box-shadow,color]",
            item.active ? "bg-white/[0.12] text-[#F2F2EF]" : "text-[#9A9A96] hover:text-[#F2F2EF]"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="app-field inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9A9A96]">
      {children}
    </span>
  );
}

const PRIORITY: Record<string, string> = { critical: "P0", high: "P1", medium: "P2", low: "P3" };

/** Compact muted priority, P0–P3; nothing for "none". */
export function PriorityMark({ priority }: { priority: string }) {
  const code = PRIORITY[priority];
  if (!code) return null;
  return (
    <span
      title={`${priority[0].toUpperCase()}${priority.slice(1)} priority`}
      className={cn("font-mono text-[11px] tabular-nums", priority === "critical" ? "font-semibold text-[#F0A39B]" : "text-[#9A9A96]")}
    >
      {code}
      <span className="sr-only"> priority</span>
    </span>
  );
}

const WEIGHT: Record<number, string> = { 1: "Small", 2: "Normal", 4: "Major", 8: "Milestone" };

export function WeightMark({ weight }: { weight: number }) {
  return (
    <span title={`${WEIGHT[weight] ?? "Weight"} task, ${weight} execution`} className="font-mono text-[11px] tabular-nums text-[#9A9A96]">
      ×{weight}
      <span className="sr-only"> weight</span>
    </span>
  );
}

export function DueLabel({ due }: { due: DueState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] tabular-nums",
        due.tone === "overdue" ? "font-semibold text-[#F0A39B]" : due.tone === "today" ? "font-semibold text-[#F2F2EF]" : "text-[#9A9A96]"
      )}
    >
      {due.tone === "overdue" && (
        <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3">
          <path d="M6 1.5 11 10.5H1L6 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 5v2.3M6 8.6v.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )}
      {due.label}
    </span>
  );
}

export function Avatar({ name, initials, className }: { name: string; initials: string; className?: string }) {
  return (
    <span
      title={name}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full bg-[#1F1F1F] text-[10px] font-semibold text-[#D4D4D0] border border-white/15",
        className
      )}
    >
      <span aria-hidden="true">{initials}</span>
      <span className="sr-only">{name}</span>
    </span>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A9A96]">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-[44ch] text-sm leading-relaxed text-[#9A9A96]">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Big tabular number with its label and the formula that produced it. */
export function Measure({
  label,
  value,
  unit,
  formula,
  delta,
  inverse,
}: {
  label: string;
  value: string;
  unit?: string;
  formula?: string;
  delta?: React.ReactNode;
  inverse?: boolean;
}) {
  return (
    <div className={cn("min-w-0 p-5", inverse ? "app-inverse rounded-[24px]" : "app-panel")}>
      <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", inverse ? "text-[#55554F]" : "text-[#9A9A96]")}>{label}</p>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className={cn("text-[2rem] font-semibold leading-none tracking-[-0.02em] tabular-nums", inverse ? "text-[#0A0A0A]" : "text-[#F2F2EF]")}>
          {value}
        </span>
        {unit && <span className={cn("text-sm", inverse ? "text-[#55554F]" : "text-[#9A9A96]")}>{unit}</span>}
      </p>
      {delta && <p className="mt-1.5 text-xs tabular-nums">{delta}</p>}
      {formula && (
        <p className={cn("mt-3 font-mono text-[11px] leading-relaxed", inverse ? "text-[#55554F]" : "text-[#85857F]")}>{formula}</p>
      )}
    </div>
  );
}

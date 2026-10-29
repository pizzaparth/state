import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { DISPLAY, TICK } from "@/lib/type";
import type { DueState } from "@/lib/format";
import { weightLabel } from "@/lib/weights";
import { TabLinks } from "./tab-links";

/**
 * Product-surface primitives on the flat AMOLED surface scale (styles/product.css):
 *   Panel           #0A0A0A + hairline (columns, metric panels, toolbars)
 *   Field / Rail    #000 + stronger hairline (inputs, progress rails, segmented controls)
 *   Rows, labels    directly on the page, no surface
 *
 * Type: titles and big numbers use DISPLAY, labels TICK (lib/type.ts). Copy stays to a
 * few words.
 */
export { DISPLAY, TICK };

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
        {label && <p className={cn(TICK, "text-[#9A9A96]")}>{label}</p>}
        <h1 className={cn(DISPLAY, "mt-2 scroll-mt-24 break-words text-[clamp(2.25rem,6vw,4.25rem)] leading-[0.9] text-[#F2F2EF] text-balance")}>
          {title}
        </h1>
        {description && <p className="mt-3 max-w-[56ch] text-base leading-relaxed text-[#9A9A96]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** "← Projects" style link back to a parent list, placed above a page header. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href as Route}
      className="-ml-2 inline-flex min-h-9 items-center gap-1.5 rounded-[10px] px-2 text-base text-[#9A9A96] transition-colors hover:bg-white/[0.04] hover:text-[#F2F2EF]"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {children}
    </Link>
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
          {title && <h2 className={cn(TICK, "text-[#9A9A96]")}>{title}</h2>}
          {aside && <div className="font-mono text-sm tabular-nums text-[#85857F]">{aside}</div>}
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
      <div className="h-full origin-left animate-grow-x rounded-full bg-[#F2F2EF] transition-transform duration-300" style={{ transform: `scaleX(${pct / 100})` }} />
    </div>
  );
}

/** URL-driven segmented control with a sliding active indicator. */
export function SegmentedLinks({ label, items }: { label: string; items: { href: string; label: string; active: boolean }[] }) {
  return <TabLinks label={label} items={items} />;
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="app-field inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9A9A96]">
      {children}
    </span>
  );
}

const PRIORITY: Record<string, { label: string; bars: number }> = {
  critical: { label: "Critical", bars: 3 },
  high: { label: "High", bars: 3 },
  medium: { label: "Medium", bars: 2 },
  low: { label: "Low", bars: 1 },
};

/** Priority as a signal-bars glyph plus its name; nothing for "none". */
export function PriorityMark({ priority }: { priority: string }) {
  const p = PRIORITY[priority];
  if (!p) return null;
  const critical = priority === "critical";
  return (
    <span
      title={`${p.label} priority`}
      className={cn("inline-flex items-center gap-1 text-[13px]", critical ? "font-semibold text-[#F0A39B]" : "text-[#9A9A96]")}
    >
      <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3">
        {[0, 1, 2].map((i) => (
          <rect key={i} x={1 + i * 4} y={8 - i * 3} width="2.5" height={3 + i * 3} rx="0.6" fill="currentColor" opacity={i < p.bars ? 1 : 0.25} />
        ))}
      </svg>
      {p.label}
      <span className="sr-only"> priority</span>
    </span>
  );
}

/** Task weight as the execution it adds when done: "+4". */
export function WeightMark({ weight }: { weight: number }) {
  return (
    <span title={`${weightLabel(weight)}: adds ${weight} execution when done`} className="font-mono text-[13px] font-semibold tabular-nums text-[#F2F2EF]">
      <span className="sr-only">Weight </span>+{weight}
    </span>
  );
}

export function DueLabel({ due }: { due: DueState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[13px] tabular-nums",
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
        "grid size-6 shrink-0 place-items-center rounded-full bg-[#1F1F1F] text-[12px] font-semibold text-[#D4D4D0] border border-white/15",
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
      <p className={cn(DISPLAY, "text-xl text-[#6F6F6B]")}>{title}</p>
      {children && <p className="mx-auto mt-2 max-w-[36ch] text-sm text-[#85857F]">{children}</p>}
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
      <p className={cn(TICK, inverse ? "text-[#55554F]" : "text-[#9A9A96]")}>{label}</p>
      <p className="mt-4 flex items-baseline gap-1.5">
        <span className={cn(DISPLAY, "text-[2.5rem] leading-none tabular-nums", inverse ? "text-[#0A0A0A]" : "text-[#F2F2EF]")}>{value}</span>
        {unit && <span className={cn("font-mono text-sm", inverse ? "text-[#55554F]" : "text-[#9A9A96]")}>{unit}</span>}
      </p>
      {delta && <p className="mt-2 font-mono text-sm tabular-nums">{delta}</p>}
      {formula && (
        <p className={cn("mt-3 font-mono text-[12px] leading-relaxed", inverse ? "text-[#55554F]" : "text-[#85857F]")}>{formula}</p>
      )}
    </div>
  );
}

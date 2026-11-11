import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { DISPLAY, TICK } from "@/lib/type";
import type { DueState } from "@/lib/format";
import { weightLabel } from "@/lib/weights";
import { Sparkline } from "./charts";
import { CountUp } from "./count-up";
import { TabLinks } from "./tab-links";

/**
 * Product-surface primitives on three flat layers (styles/product.css), with the accent
 * (#FF3D8B) as the focal layer on top:
 *   Layer 0 page    #0F1B3D: rows, labels, ledgers sit directly on it
 *   Layer 1 Panel   #16244D + hairline (columns, metric panels, toolbars)
 *   Layer 2 card    #1E2E5C + stronger hairline (task cards, buttons, menus)
 *   Field / Rail    #0F1B3D inset + stronger hairline (inputs, progress rails, segmented controls)
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
        {label && <p className={cn(TICK, "text-accent")}>{label}</p>}
        <h1 className={cn(DISPLAY, "mt-2 scroll-mt-24 break-words text-[clamp(2.25rem,6vw,4.25rem)] leading-[0.9] text-[#FFFFFF] text-balance")}>
          {title}
        </h1>
        {description && <p className="mt-3 max-w-[56ch] text-base leading-relaxed text-[#B4BEDB]">{description}</p>}
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
      className="-ml-2 inline-flex min-h-9 items-center gap-1.5 rounded-[10px] px-2 text-base text-[#B4BEDB] transition-colors hover:bg-white/[0.04] hover:text-[#FFFFFF]"
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
          {title && (
            <h2 className={cn(TICK, "flex items-center gap-2 text-[#DCE2F2]")}>
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-[2px] bg-accent" />
              {title}
            </h2>
          )}
          {aside && <div className="font-mono text-sm tabular-nums text-[#8E9AC0]">{aside}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

/** Inset progress rail with an accent fill. */
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
      <div className="h-full origin-left animate-grow-x rounded-full bg-accent transition-transform duration-300" style={{ transform: `scaleX(${pct / 100})` }} />
    </div>
  );
}

/** URL-driven segmented control with a sliding active indicator. */
export function SegmentedLinks({ label, items }: { label: string; items: { href: string; label: string; active: boolean }[] }) {
  return <TabLinks label={label} items={items} />;
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="app-field inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#B4BEDB]">
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
      className={cn("inline-flex items-center gap-1 text-[13px]", critical ? "font-semibold text-[#F0A39B]" : "text-[#B4BEDB]")}
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
    <span title={`${weightLabel(weight)}: adds ${weight} execution when done`} className="font-mono text-[13px] font-semibold tabular-nums text-accent">
      <span className="sr-only">Weight </span>+{weight}
    </span>
  );
}

export function DueLabel({ due }: { due: DueState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[13px] tabular-nums",
        due.tone === "overdue" ? "font-semibold text-[#F0A39B]" : due.tone === "today" ? "font-semibold text-[#FFFFFF]" : "text-[#B4BEDB]"
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
        "grid size-6 shrink-0 place-items-center rounded-full bg-[#1E2E5C] text-[12px] font-semibold text-[#DCE2F2] border border-white/15",
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
      <p className={cn(DISPLAY, "text-xl text-[#8E9AC0]")}>{title}</p>
      {children && <p className="mx-auto mt-2 max-w-[36ch] text-sm text-[#8E9AC0]">{children}</p>}
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
  spark,
}: {
  label: string;
  value: string;
  unit?: string;
  formula?: string;
  delta?: React.ReactNode;
  inverse?: boolean;
  /** Recent values drawn as a trend line beside the label. */
  spark?: number[];
}) {
  return (
    <div className={cn("min-w-0 p-5", inverse ? "app-inverse rounded-[24px]" : "app-panel")}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn(TICK, inverse ? "text-accent-muted" : "text-[#B4BEDB]")}>{label}</p>
        {spark && <Sparkline values={spark} inverse={inverse} />}
      </div>
      <p className="mt-4 flex items-baseline gap-1.5">
        <span className={cn(DISPLAY, "text-[2.5rem] leading-none tabular-nums", inverse ? "text-[#0F1B3D]" : "text-[#FFFFFF]")}>
          <CountUp value={value} />
        </span>
        {unit && <span className={cn("font-mono text-sm", inverse ? "text-accent-muted" : "text-[#B4BEDB]")}>{unit}</span>}
      </p>
      {delta && <p className="mt-2 font-mono text-sm tabular-nums">{delta}</p>}
      {formula && (
        <p className={cn("mt-3 font-mono text-[12px] leading-relaxed", inverse ? "text-accent-muted" : "text-[#8E9AC0]")}>{formula}</p>
      )}
    </div>
  );
}

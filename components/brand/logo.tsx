import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * State mark (branding/logo-mark.svg) as inline SVG so it inherits currentColor and
 * needs no request. useId keeps mask ids unique when several marks render on a page.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const maskId = `state-crosshair-${React.useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="-340 -340 680 680"
      fill="none"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-340" y="-340" width="680" height="680">
          <rect x="-340" y="-340" width="680" height="680" fill="#fff" />
          <rect x="-12.5" y="-340" width="25" height="680" fill="#000" />
          <rect x="-340" y="-12.5" width="680" height="25" fill="#000" />
        </mask>
      </defs>
      <g stroke="currentColor" mask={`url(#${maskId})`}>
        <circle r="323" strokeWidth="16" />
        <circle r="242.5" strokeWidth="14" />
      </g>
      <circle r="111" stroke="currentColor" strokeWidth="123" />
    </svg>
  );
}

/** Mark plus wordmark, for navigation and headers. */
export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn("size-6", markClassName)} />
      <span className="font-display uppercase tracking-[0.04em]" translate="no">
        State
      </span>
    </span>
  );
}

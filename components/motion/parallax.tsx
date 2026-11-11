"use client";

import * as React from "react";

/**
 * Multi-layer parallax. One controller per page listens to a scroller (the window on
 * marketing pages, the product's <main> elsewhere) and to the pointer, then moves layers
 * at different speeds with transform only:
 *
 *   ParallaxBackdrop   three fixed layers behind the content (far, mid, near). Each is a
 *                      repeating tile, moved by -scroll × depth modulo its tile height, so
 *                      it never runs out on long pages.
 *   [data-depth]       elements inside the content drift against the scroll by their
 *                      distance from the viewport centre × depth.
 *
 * Reads happen before writes in one animation frame. Reduced motion turns it all off.
 */

type Scroller = "window" | string;

function useParallax(scroller: Scroller, root: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target: HTMLElement | Window | null = scroller === "window" ? window : document.querySelector<HTMLElement>(scroller);
    if (!target) return;
    const scrollTop = () => (target === window ? window.scrollY : (target as HTMLElement).scrollTop);
    const viewH = () => (target === window ? window.innerHeight : (target as HTMLElement).clientHeight);
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    let px = 0;
    let py = 0;
    let frame = 0;

    const update = () => {
      frame = 0;
      const top = scrollTop();
      const mid = viewH() / 2;
      // Reads
      const layers = root.current ? Array.from(root.current.querySelectorAll<HTMLElement>("[data-layer]")) : [];
      const scope: ParentNode = target === window ? document : (target as HTMLElement);
      const items = Array.from(scope.querySelectorAll<HTMLElement>("[data-depth]")).map((el) => {
        const anchor = el.parentElement?.getBoundingClientRect();
        return { el, depth: Number(el.dataset.depth) || 0, offset: anchor ? anchor.top + anchor.height / 2 - mid : 0 };
      });
      // Writes
      for (const layer of layers) {
        const depth = Number(layer.dataset.layer) || 0;
        const tile = Number(layer.dataset.tile) || 600;
        const y = -((top * depth) % tile);
        layer.style.transform = `translate3d(${(px * depth * 40).toFixed(1)}px, ${(y + py * depth * 40).toFixed(1)}px, 0)`;
      }
      for (const { el, depth, offset } of items) {
        el.style.transform = `translate3d(${(px * depth * 30).toFixed(1)}px, ${(-offset * depth + py * depth * 30).toFixed(1)}px, 0)`;
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onPointer = (e: PointerEvent) => {
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
      schedule();
    };

    update();
    target.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    if (finePointer) window.addEventListener("pointermove", onPointer, { passive: true });
    // New content (route changes, streamed sections) may bring new [data-depth] elements
    const observer = new MutationObserver(schedule);
    if (target !== window) observer.observe(target as HTMLElement, { childList: true, subtree: true });
    else observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      target.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pointermove", onPointer);
      observer.disconnect();
    };
  }, [scroller, root]);
}

const svg = (body: string, size: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${body}</svg>`)}")`;

// Far: a quiet dot grid. Mid: large accent outlines. Near: small crosses and accent squares.
const FAR = svg(`<circle cx='2' cy='2' r='1' fill='rgba(255,255,255,0.09)'/>`, 28);
const MID = svg(
  `<circle cx='140' cy='160' r='90' fill='none' stroke='rgba(232,53,127,0.16)' stroke-width='1.5'/>` +
    `<rect x='430' y='380' width='120' height='120' rx='14' fill='none' stroke='rgba(255,255,255,0.08)' stroke-width='1.5' transform='rotate(12 490 440)'/>` +
    `<circle cx='520' cy='120' r='36' fill='none' stroke='rgba(255,255,255,0.07)' stroke-width='1.5'/>` +
    `<rect x='90' y='470' width='60' height='60' rx='8' fill='rgba(232,53,127,0.06)'/>`,
  640
);
const NEAR = svg(
  `<path d='M60 52v16M52 60h16' stroke='rgba(255,255,255,0.22)' stroke-width='1.5'/>` +
    `<rect x='300' y='210' width='7' height='7' fill='rgba(232,53,127,0.55)'/>` +
    `<path d='M380 360v12M374 366h12' stroke='rgba(232,53,127,0.45)' stroke-width='1.5'/>` +
    `<circle cx='150' cy='330' r='2.5' fill='rgba(255,255,255,0.25)'/>`,
  440
);

const LAYERS = [
  { depth: 0.08, tile: 28, image: FAR },
  { depth: 0.25, tile: 640, image: MID },
  { depth: 0.5, tile: 440, image: NEAR },
] as const;

/** Three fixed parallax layers behind a page, plus the controller for [data-depth]. */
export function ParallaxBackdrop({ scroller = "window" }: { scroller?: Scroller }) {
  const root = React.useRef<HTMLDivElement>(null);
  useParallax(scroller, root);
  return (
    <div ref={root} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {LAYERS.map((l) => (
        <div
          key={l.depth}
          data-layer={l.depth}
          data-tile={l.tile}
          className="absolute -inset-x-16 top-0 will-change-transform"
          style={{ height: `calc(100% + ${l.tile * 2}px)`, top: `-${l.tile}px`, backgroundImage: l.image, backgroundRepeat: "repeat" }}
        />
      ))}
    </div>
  );
}

/** Wraps content that drifts against the scroll (depth > 0 lags, < 0 leads). */
export function Depth({ depth, children, className }: { depth: number; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div data-depth={depth} suppressHydrationWarning className="will-change-transform">
        {children}
      </div>
    </div>
  );
}

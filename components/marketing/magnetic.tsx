"use client";

import * as React from "react";
import { motion, useSpring, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";

const SPRING = { stiffness: 260, damping: 18, mass: 0.5 };

const MagneticContext = React.createContext<{ x: MotionValue<number>; y: MotionValue<number> } | null>(null);

/**
 * Pulls its child toward the pointer once the pointer comes within `radius` px of the
 * child's edge, and springs back when it leaves. Pull fades to zero at the edge of the
 * field so there is no jump. Disabled for touch and reduced motion; transform-only.
 */
export function Magnetic({
  children,
  strength = 0.4,
  radius = 120,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  radius?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const x = useSpring(0, SPRING);
  const y = useSpring(0, SPRING);
  const scale = useSpring(1, SPRING);
  // Label travels further than the button for a slight parallax
  const labelX = useSpring(0, SPRING);
  const labelY = useSpring(0, SPRING);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let frame = 0;
    const settle = () => {
      x.set(0);
      y.set(0);
      labelX.set(0);
      labelY.set(0);
      scale.set(1);
    };

    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Measure the untransformed box so the field does not drift with the button
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2 - x.get();
        const cy = rect.top + rect.height / 2 - y.get();
        const dx = event.clientX - cx;
        const dy = event.clientY - cy;
        const reach = radius + Math.max(rect.width, rect.height) / 2;
        const dist = Math.hypot(dx, dy);
        if (dist >= reach) return settle();

        const pull = Math.sqrt(1 - dist / reach);
        x.set(dx * strength * pull);
        y.set(dy * strength * pull);
        labelX.set(dx * strength * 0.35 * pull);
        labelY.set(dy * strength * 0.35 * pull);
        scale.set(1 + 0.07 * pull);
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", settle);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", settle);
    };
  }, [x, y, labelX, labelY, scale, strength, radius]);

  return (
    <MagneticContext.Provider value={{ x: labelX, y: labelY }}>
      <motion.span ref={ref} style={{ x, y, scale }} className={cn("inline-block will-change-transform", className)}>
        {children}
      </motion.span>
    </MagneticContext.Provider>
  );
}

/** Wrap a magnetic button's label so it drifts slightly further than the button body. */
export function MagneticLabel({ children }: { children: React.ReactNode }) {
  const ctx = React.useContext(MagneticContext);
  return (
    <motion.span style={ctx ? { x: ctx.x, y: ctx.y } : undefined} className="inline-block">
      {children}
    </motion.span>
  );
}

"use client";

import * as React from "react";

/**
 * Ambient field of tiny points. Near the pointer, points are pulled onto a lattice and
 * square off into cells — scattered effort becoming measured execution. A tap or click
 * scatters them again. Static frame under prefers-reduced-motion.
 */

const LATTICE = 18;
const RADIUS = 180;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  driftX: number;
  driftY: number;
  size: number;
  alpha: number;
  accent: boolean;
  order: number; // 0 = loose dot, 1 = aligned cell
}

export function ParticleField() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const pointer = { x: -9999, y: -9999, active: false };
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;

    const seed = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(coarse ? 140 : 340, Math.round((width * height) / (coarse ? 9000 : 4800)));
      particles = Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.04 + Math.random() * 0.12;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: 0,
          vy: 0,
          driftX: Math.cos(angle) * speed,
          driftY: Math.sin(angle) * speed,
          size: 0.6 + Math.random() * 0.9,
          alpha: 0.12 + Math.random() * 0.3,
          // One in four particles carries the accent
          accent: Math.random() < 0.25,
          order: 0,
        };
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        const a = p.alpha + (0.85 - p.alpha) * p.order;
        ctx.fillStyle = p.accent ? `rgba(217, 43, 116, ${Math.min(1, a + 0.15)})` : `rgba(255, 255, 255, ${a})`;
        if (p.order > 0.5) {
          // Aligned: render as a small square cell, like the execution graph
          const s = p.size + 2.2 * p.order;
          ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const step = () => {
      for (const p of particles) {
        const dx = pointer.x - p.x;
        const dy = pointer.y - p.y;
        const dist = Math.hypot(dx, dy);
        const influence = pointer.active && dist < RADIUS ? 1 - dist / RADIUS : 0;

        if (influence > 0) {
          // Spring toward the nearest lattice point
          const tx = Math.round(p.x / LATTICE) * LATTICE;
          const ty = Math.round(p.y / LATTICE) * LATTICE;
          p.vx += (tx - p.x) * 0.06 * influence;
          p.vy += (ty - p.y) * 0.06 * influence;
          p.order += (Math.min(1, influence * 1.6) - p.order) * 0.12;
        } else {
          p.vx += p.driftX * 0.02;
          p.vy += p.driftY * 0.02;
          p.order += (0 - p.order) * 0.04;
        }

        p.vx *= 0.88;
        p.vy *= 0.88;
        p.x += p.vx + p.driftX * (1 - p.order);
        p.y += p.vy + p.driftY * (1 - p.order);

        if (p.x < -10) p.x = width + 10;
        else if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        else if (p.y > height + 10) p.y = -10;
      }
      draw();
      frame = requestAnimationFrame(step);
    };

    const onMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    const onDown = (event: PointerEvent) => {
      for (const p of particles) {
        const dx = p.x - event.clientX;
        const dy = p.y - event.clientY;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < RADIUS * 1.4) {
          const force = (1 - dist / (RADIUS * 1.4)) * 7;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
          p.order = 0;
        }
      }
    };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && !reducedMotion) frame = requestAnimationFrame(step);
    };
    const onResize = () => {
      seed();
      if (reducedMotion) draw();
    };

    seed();
    if (reducedMotion) {
      draw();
    } else {
      frame = requestAnimationFrame(step);
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
      document.addEventListener("visibilitychange", onVisibility);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full" />;
}

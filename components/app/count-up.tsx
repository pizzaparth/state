"use client";

import * as React from "react";

// Server HTML is already painted when hydration runs, so counting from zero there would
// flash the real value first. Only numbers mounted after hydration (client navigation)
// count up from zero; every number rolls from its old value when it changes.
let hydrated = false;

const NUMBER = /-?\d[\d,]*(?:\.\d+)?/;

function parse(text: string) {
  const match = NUMBER.exec(text);
  if (!match) return null;
  const raw = match[0];
  return {
    before: text.slice(0, match.index),
    after: text.slice(match.index + raw.length),
    value: Number(raw.replace(/,/g, "")),
    digits: raw.split(".")[1]?.length ?? 0,
    grouped: raw.includes(","),
  };
}

/**
 * A formatted number ("1,204", "84.5%", "+12", "3.2/d") that rolls to its value. Only the
 * first number in the text moves; prefix, suffix, decimals and grouping stay as given.
 * Screen readers get the final text only. Honors prefers-reduced-motion.
 */
export function CountUp({ value, duration = 600 }: { value: string; duration?: number }) {
  const target = parse(value);
  const [shown, setShown] = React.useState(value);
  const from = React.useRef<number | null>(hydrated ? 0 : null);

  React.useLayoutEffect(() => {
    hydrated = true;
    const start = from.current;
    if (!target || start === null || start === target.value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target?.value ?? null;
      setShown(value);
      return;
    }
    const { before, after, value: end, digits, grouped } = target;
    const format = new Intl.NumberFormat("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: grouped });
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const current = start + (end - start) * (1 - Math.pow(1 - t, 3));
      from.current = current;
      setShown(t < 1 ? `${before}${format.format(current)}${after}` : value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setShown(`${before}${format.format(start)}${after}`);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Re-run only when the text itself changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{value}</span>
    </>
  );
}

import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom radii in tailwind.config.ts, so a later `rounded-full`
// replaces a component's `rounded-input` instead of both landing in the class list
const twMerge = extendTailwindMerge({
  extend: {
    theme: { borderRadius: ["control", "input", "task", "card", "module"] },
  },
});

/**
 * Combines conditional CSS classes and resolves Tailwind conflicts.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

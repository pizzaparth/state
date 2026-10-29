import { LEGAL } from "@/lib/legal";

/**
 * Public origin for canonical URLs, the sitemap and Open Graph tags. Production requires
 * NEXT_PUBLIC_APP_URL to be https (lib/env.ts); the fallback keeps local builds working.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || `https://${LEGAL.domain}`).replace(/\/$/, "");

export const SITE_NAME = "State";

// Shared by the root layout and the landing page so search snippets match the page
export const SITE_TITLE = "State — To-do list and kanban app that measures your work";
export const SITE_DESCRIPTION =
  "A to-do list and kanban task manager with real metrics. Plan tasks, finish them, and see execution, velocity, cycle time and consistency as plain formulas. No ads, no AI, no surveillance.";

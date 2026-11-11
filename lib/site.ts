/**
 * Public origin for canonical URLs, the sitemap and Open Graph tags. On Vercel the
 * production domain comes from the platform when NEXT_PUBLIC_APP_URL is not set.
 */
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || (vercelHost ? `https://${vercelHost}` : "http://localhost:3000")).replace(/\/$/, "");

export const SITE_NAME = "State";

/** Who built it. Shown in the header, footer and product shell. */
export const AUTHOR = "Parth Pancholi";
export const BYLINE = `A personal hobby project by ${AUTHOR}`;

// Shared by the root layout and the landing page so search snippets match the page
export const SITE_TITLE = "State — a personal execution tracker";
export const SITE_DESCRIPTION = `${BYLINE}. A to-do list and kanban board with real metrics: execution, velocity, cycle time and consistency as plain formulas. Take a demo; nothing you enter is kept.`;

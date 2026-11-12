import { z } from "zod";

/**
 * Personal settings stored in users.preferences (jsonb). Parsed with defaults, so a
 * missing or old key never breaks a page. The time zone lives in users.timezone.
 */

const isLocale = (value: string) => {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([value]).length > 0;
  } catch {
    return false;
  }
};

export const START_PAGES = { today: "Today", inbox: "Inbox", board: "Board", metrics: "Metrics" } as const;
export const DONE_WINDOWS = [7, 14, 30] as const;

export const preferencesSchema = z.object({
  /** BCP 47 tag for dates and numbers; null = from the browser (Accept-Language). */
  locale: z.string().max(35).refine(isLocale).nullable().catch(null).default(null),
  weekStart: z.enum(["monday", "sunday"]).catch("monday").default("monday"),
  defaultWeight: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]).catch(2).default(2),
  startPage: z.enum(["today", "inbox", "board", "metrics"]).catch("today").default("today"),
  doneWindow: z.union([z.literal(7), z.literal(14), z.literal(30)]).catch(14).default(14),
  motion: z.boolean().catch(true).default(true),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const parsePreferences = (value: unknown): Preferences => preferencesSchema.parse(value && typeof value === "object" ? value : {});

/** One or more fields; each control saves on change. */
export const setPreferencesSchema = z.strictObject({
  locale: z.string().trim().max(35).refine(isLocale, "Pick a language from the list.").nullable().optional(),
  weekStart: z.enum(["monday", "sunday"]).optional(),
  defaultWeight: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]).optional(),
  startPage: z.enum(["today", "inbox", "board", "metrics"]).optional(),
  doneWindow: z.union([z.literal(7), z.literal(14), z.literal(30)]).optional(),
  motion: z.boolean().optional(),
});

/** First supported language from an Accept-Language header. */
export function localeFromHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim();
    if (tag && tag !== "*" && isLocale(tag)) return tag;
  }
  return null;
}

export const LOCALE_OPTIONS = [
  ["en-GB", "English (UK)"],
  ["en-US", "English (US)"],
  ["en-IN", "English (India)"],
  ["de-DE", "Deutsch"],
  ["fr-FR", "Français"],
  ["es-ES", "Español"],
  ["it-IT", "Italiano"],
  ["nl-NL", "Nederlands"],
  ["pt-BR", "Português (Brasil)"],
  ["ja-JP", "日本語"],
] as const;

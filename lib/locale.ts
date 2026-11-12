import { cache } from "react";

/**
 * The viewer's locale for every date and number.
 *
 *   server components   set per request by getViewer (React cache is request-scoped)
 *   client components   set by the shell from the same value before its children render
 *                       (in the browser, and while the server renders them for hydration)
 */
export const DEFAULT_LOCALE = "en-GB";

const requestStore = cache((): { locale: string; set: boolean } => ({ locale: DEFAULT_LOCALE, set: false }));
// Client components: the browser's single viewer; on the server, the last shell rendered
let shellLocale: string | null = null;

/** Server components: once per request (getViewer). */
export function setRequestLocale(locale: string) {
  try {
    const store = requestStore();
    store.locale = locale;
    store.set = true;
  } catch {
    // Outside a request (scripts): keep the default
  }
}

/** Client components: from the shell, before its children render. */
export function setShellLocale(locale: string) {
  shellLocale = locale;
}

export function currentLocale(): string {
  if (typeof window === "undefined") {
    try {
      const store = requestStore();
      if (store.set) return store.locale;
    } catch {
      // not in a request
    }
  }
  return shellLocale ?? DEFAULT_LOCALE;
}

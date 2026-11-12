/**
 * Side panels (?task=, ?commit=, …) open with a history push and should close with Back,
 * so history does not end up as page → page. A panel opened from inside the app leaves a
 * mark in sessionStorage (per tab) naming the URL it pushed; closing goes back when the
 * current URL is still that one, and otherwise (a deep link, a pasted URL) replaces.
 */

export const PANEL_PARAMS = ["task", "commit", "objective", "metric"] as const;

const KEY = "state:panel-origin";

const absolute = (href: string) => new URL(href, window.location.href).href;

function read(): { to: string } | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as { to: string }) : null;
  } catch {
    return null;
  }
}

function write(value: { to: string } | null) {
  try {
    if (value) window.sessionStorage.setItem(KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: closing falls back to replace
  }
}

const opensPanel = (url: URL) => PANEL_PARAMS.some((p) => url.searchParams.has(p));

/** Call before an in-app navigation (push) that opens a panel. */
export function markPanelOpen(href: string) {
  write({ to: absolute(href) });
}

/** A panel swapped in place (replace): keep the mark pointing at the URL now shown. */
export function retargetPanel(href: string) {
  if (read()?.to === window.location.href) write({ to: absolute(href) });
}

/** True when Back would return to the page the panel was opened from. */
export function panelCameFromApp(): boolean {
  return read()?.to === window.location.href;
}

export function clearPanelMark() {
  write(null);
}

/**
 * Document-level click listener: marks plain left clicks on links that add a panel param
 * the current URL does not have. Returns the cleanup.
 */
export function watchPanelLinks(): () => void {
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin || !opensPanel(url)) return;
    const here = new URL(window.location.href);
    // Swaps between panels on the same page use replace (PanelLink), not a push
    if (opensPanel(here) && anchor.dataset.panelSwap !== undefined) return;
    if (!opensPanel(here)) markPanelOpen(url.href);
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}

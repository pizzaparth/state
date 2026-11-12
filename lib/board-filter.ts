/**
 * Board filter: deterministic and client-side, like the sort. Kept in the URL
 * (`project`, `priority`, `tag`, `due`, `q`) and mirrored in the `board_filter` cookie as
 * a query string, so the board opens the same way next time.
 */

export const DUE_FILTERS = {
  overdue: "Overdue",
  today: "Due today",
  week: "This week",
  none: "No due date",
} as const;
export type DueFilter = keyof typeof DUE_FILTERS;

export interface BoardFilter {
  project?: string;
  priority?: string;
  tag?: string;
  due?: DueFilter;
  q?: string;
}

export const BOARD_FILTER_COOKIE = "board_filter";
export const BOARD_FILTER_KEYS = ["project", "priority", "tag", "due", "q"] as const;

const PRIORITY_VALUES = new Set(["none", "low", "medium", "high", "critical"]);

/** Reads a filter from search params (or the cookie's query string). Unknown values are dropped. */
export function parseBoardFilter(input: URLSearchParams | Record<string, string | undefined> | string | null | undefined): BoardFilter {
  const params =
    input instanceof URLSearchParams
      ? input
      : typeof input === "string"
        ? new URLSearchParams(input.slice(0, 1000))
        : new URLSearchParams(Object.entries(input ?? {}).filter((e): e is [string, string] => typeof e[1] === "string"));
  const out: BoardFilter = {};
  const project = params.get("project")?.trim().toLowerCase();
  if (project && /^[a-z0-9-]{1,100}$/.test(project)) out.project = project;
  const priority = params.get("priority");
  if (priority && PRIORITY_VALUES.has(priority)) out.priority = priority;
  const tag = params.get("tag")?.trim().toLowerCase();
  if (tag && tag.length <= 50) out.tag = tag;
  const due = params.get("due");
  if (due && Object.hasOwn(DUE_FILTERS, due)) out.due = due as DueFilter;
  const q = params.get("q")?.trim();
  if (q) out.q = q.slice(0, 100);
  return out;
}

export function formatBoardFilter(filter: BoardFilter): string {
  const params = new URLSearchParams();
  for (const key of BOARD_FILTER_KEYS) {
    const value = filter[key];
    if (value) params.set(key, value);
  }
  return params.toString();
}

export const isFiltered = (filter: BoardFilter) => BOARD_FILTER_KEYS.some((k) => Boolean(filter[k]));

export interface FilterableCard {
  title: string;
  projectSlug: string | null;
  priority: string;
  tags: string[];
  /** Due day as YYYY-MM-DD in the viewer's zone. */
  dueDay: string | null;
}

/** Days from `today` to the end of its ISO week (Sunday). */
const daysToWeekEnd = (today: string) => (7 - new Date(`${today}T00:00:00Z`).getUTCDay()) % 7;

const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Cards matching every set field. `today` is YYYY-MM-DD in the viewer's zone. */
export function filterCards<T extends FilterableCard>(cards: T[], filter: BoardFilter, today: string): T[] {
  if (!isFiltered(filter)) return cards;
  const q = filter.q?.toLowerCase();
  const weekEnd = shift(today, daysToWeekEnd(today));
  return cards.filter((c) => {
    if (filter.project && c.projectSlug !== filter.project) return false;
    if (filter.priority && c.priority !== filter.priority) return false;
    if (filter.tag && !c.tags.includes(filter.tag)) return false;
    if (filter.due) {
      const d = c.dueDay;
      if (filter.due === "none" && d !== null) return false;
      if (filter.due === "overdue" && !(d !== null && d < today)) return false;
      if (filter.due === "today" && d !== today) return false;
      if (filter.due === "week" && !(d !== null && d >= today && d <= weekEnd)) return false;
    }
    if (q && !c.title.toLowerCase().includes(q)) return false;
    return true;
  });
}

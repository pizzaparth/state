import { WEIGHT_LEVELS } from "@/lib/weights";

/**
 * Board filters, deterministic and client-side.
 *
 * - Board-wide: the text field (`q`), kept in the URL and the `board_filter` cookie. Links
 *   from other pages may also name `work`, `priority`, `tag` or `due`; those apply from
 *   the URL only and are never saved, so the board does not reopen behind a hidden filter.
 * - Per column: weight, priority and due, saved in the `board_column_filter` cookie as
 *   JSON keyed by column id.
 */

export const DUE_FILTERS = {
  overdue: "Overdue",
  today: "Due today",
  week: "This week",
  none: "No due date",
} as const;
export type DueFilter = keyof typeof DUE_FILTERS;

export interface BoardFilter {
  /** Work slug. */
  work?: string;
  priority?: string;
  tag?: string;
  due?: DueFilter;
  q?: string;
}

export const BOARD_FILTER_COOKIE = "board_filter";
export const BOARD_FILTER_KEYS = ["work", "priority", "tag", "due", "q"] as const;

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
  // `project` is the key from before work was renamed (old links and cookies)
  const work = (params.get("work") ?? params.get("project"))?.trim().toLowerCase();
  if (work && /^[a-z0-9-]{1,100}$/.test(work)) out.work = work;
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

/** Whether a due day (YYYY-MM-DD or null) falls in `due`, seen from `today`. */
function matchesDue(d: string | null, due: DueFilter, today: string): boolean {
  if (due === "none") return d === null;
  if (d === null) return false;
  if (due === "overdue") return d < today;
  if (due === "today") return d === today;
  return d >= today && d <= shift(today, daysToWeekEnd(today));
}

/** Cards matching every set field. `today` is YYYY-MM-DD in the viewer's zone. */
export function filterCards<T extends FilterableCard>(cards: T[], filter: BoardFilter, today: string): T[] {
  if (!isFiltered(filter)) return cards;
  const q = filter.q?.toLowerCase();
  return cards.filter((c) => {
    if (filter.work && c.projectSlug !== filter.work) return false;
    if (filter.priority && c.priority !== filter.priority) return false;
    if (filter.tag && !c.tags.includes(filter.tag)) return false;
    if (filter.due && !matchesDue(c.dueDay, filter.due, today)) return false;
    if (q && !c.title.toLowerCase().includes(q)) return false;
    return true;
  });
}

// ------------------------------------------------------------ per-column filters

export interface ColumnFilter {
  weight?: number;
  priority?: string;
  due?: DueFilter;
}
/** Column id to that column's filter; columns without one are left out. */
export type ColumnFilters = Record<string, ColumnFilter>;

export const COLUMN_FILTER_COOKIE = "board_column_filter";

const WEIGHT_VALUES = new Set<number>(WEIGHT_LEVELS.map((w) => w.value));

export const isColumnFiltered = (f: ColumnFilter | undefined): f is ColumnFilter => Boolean(f && (f.weight || f.priority || f.due));

/** Reads the cookie's JSON. Unknown columns, keys and values are dropped. */
export function parseColumnFilters(raw: string | null | undefined): ColumnFilters {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(0, 4000));
  } catch {
    return {};
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const out: ColumnFilters = {};
  for (const [id, value] of Object.entries(data).slice(0, 50)) {
    if (!/^[\w-]{1,64}$/.test(id) || !value || typeof value !== "object") continue;
    const { weight, priority, due } = value as Record<string, unknown>;
    const f: ColumnFilter = {};
    if (typeof weight === "number" && WEIGHT_VALUES.has(weight)) f.weight = weight;
    if (typeof priority === "string" && PRIORITY_VALUES.has(priority)) f.priority = priority;
    if (typeof due === "string" && Object.hasOwn(DUE_FILTERS, due)) f.due = due as DueFilter;
    if (isColumnFiltered(f)) out[id] = f;
  }
  return out;
}

export function formatColumnFilters(filters: ColumnFilters): string {
  return JSON.stringify(Object.fromEntries(Object.entries(filters).filter(([, f]) => isColumnFiltered(f))));
}

/** Whether one card passes a column's filter. */
export function matchesColumnFilter(card: FilterableCard & { weight: number }, f: ColumnFilter | undefined, today: string): boolean {
  if (!isColumnFiltered(f)) return true;
  if (f.weight && card.weight !== f.weight) return false;
  if (f.priority && card.priority !== f.priority) return false;
  if (f.due && !matchesDue(card.dueDay, f.due, today)) return false;
  return true;
}

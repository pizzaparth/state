/**
 * Board sort: an ordered list of keys (first key wins, later keys break ties, manual
 * position breaks the rest). Deterministic and client-side; the server stores nothing.
 *
 * Serialised as `field.dir` pairs joined by commas, e.g. `priority.desc,due.asc`, in the
 * `sort` search param and the `board_sort` cookie. `manual` (or nothing) means the
 * board's own drag order.
 */

export const SORT_FIELDS = {
  priority: { label: "Priority", defaultDir: "desc", asc: "Low first", desc: "High first" },
  due: { label: "Due", defaultDir: "asc", asc: "Soonest first", desc: "Latest first" },
  weight: { label: "Weight", defaultDir: "desc", asc: "Lightest first", desc: "Heaviest first" },
  title: { label: "Title", defaultDir: "asc", asc: "A–Z", desc: "Z–A" },
  project: { label: "Project", defaultDir: "asc", asc: "A–Z", desc: "Z–A" },
  created: { label: "Created", defaultDir: "desc", asc: "Oldest first", desc: "Newest first" },
} as const satisfies Record<string, { label: string; defaultDir: SortDir; asc: string; desc: string }>;

export type SortDir = "asc" | "desc";
export type SortField = keyof typeof SORT_FIELDS;
export interface SortKey {
  field: SortField;
  dir: SortDir;
}

export const SORT_FIELD_NAMES = Object.keys(SORT_FIELDS) as SortField[];
export const BOARD_SORT_PARAM = "sort";
export const BOARD_SORT_COOKIE = "board_sort";
export const MANUAL_SORT = "manual";

const isField = (value: string): value is SortField => Object.hasOwn(SORT_FIELDS, value);

/** Reads a serialised sort. Unknown fields and repeats are dropped; anything else is manual. */
export function parseBoardSort(value: string | null | undefined): SortKey[] {
  if (!value || value === MANUAL_SORT) return [];
  const keys: SortKey[] = [];
  for (const part of value.slice(0, 200).split(",")) {
    const [field, dir] = part.trim().toLowerCase().split(".");
    if (!field || !isField(field) || keys.some((k) => k.field === field)) continue;
    keys.push({ field, dir: dir === "asc" || dir === "desc" ? dir : SORT_FIELDS[field].defaultDir });
  }
  return keys;
}

export function formatBoardSort(keys: SortKey[]): string {
  return keys.length === 0 ? MANUAL_SORT : keys.map((k) => `${k.field}.${k.dir}`).join(",");
}

/** "Priority, high first, then Due, soonest first" */
export function describeBoardSort(keys: SortKey[]): string {
  if (keys.length === 0) return "Manual order";
  return keys.map((k) => `${SORT_FIELDS[k.field].label}, ${SORT_FIELDS[k.field][k.dir].toLowerCase()}`).join(", then ");
}

export interface SortableCard {
  title: string;
  priority: string;
  weight: number;
  projectName: string | null;
  /** Epoch ms */
  dueAt: number | null;
  /** Epoch ms */
  createdAt: number;
}

const PRIORITY_RANK: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** Compares one field ascending. `null` means "no value", which always sorts last. */
function value(card: SortableCard, field: SortField): number | string | null {
  switch (field) {
    case "priority":
      return PRIORITY_RANK[card.priority] ?? 0;
    case "due":
      return card.dueAt;
    case "weight":
      return card.weight;
    case "title":
      return card.title;
    case "project":
      return card.projectName;
    case "created":
      return card.createdAt;
  }
}

/**
 * Stable sort by `keys`; ties keep the incoming (manual) order. Missing due dates and
 * projects go last in either direction, so flipping a key never floats blanks to the top.
 */
export function sortCards<T extends SortableCard>(cards: T[], keys: SortKey[]): T[] {
  if (keys.length === 0) return cards;
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      for (const { field, dir } of keys) {
        const x = value(a.card, field);
        const y = value(b.card, field);
        if (x === y) continue;
        if (x === null) return 1;
        if (y === null) return -1;
        const order = typeof x === "string" && typeof y === "string" ? collator.compare(x, y) : (x as number) - (y as number);
        if (order !== 0) return dir === "asc" ? order : -order;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.card);
}

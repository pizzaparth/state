/** The last ten tasks and commits opened in this browser (palette, empty query). */

export interface RecentItem {
  kind: "task" | "commit";
  id: string;
  title: string;
  href: string;
}

const KEY = "state:recent";

export function readRecent(): RecentItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]).slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function recordRecent(item: RecentItem) {
  try {
    const list = [item, ...readRecent().filter((r) => !(r.kind === item.kind && r.id === item.id))].slice(0, 10);
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: no recents
  }
}

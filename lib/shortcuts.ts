/**
 * Every keyboard shortcut, in one list. The shell's key handler, the command palette's
 * hints, the Preferences table and the `?` sheet are all built from it, so they cannot
 * disagree. Keys are written as typed: "G T" is G, then T.
 */

export type ShortcutAction = "palette" | "commit" | "capture" | "shortcuts" | "undo";

export interface Shortcut {
  keys: string;
  label: string;
  /** Where it works. Global ones are handled by the shell. */
  scope: "Anywhere" | "Go to" | "Board" | "Inbox" | "Task panel";
  /** Navigation target (G sequences). */
  href?: string;
  /** Shell action for single-key globals. */
  action?: ShortcutAction;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { keys: "⌘ K", label: "Commands", scope: "Anywhere", action: "palette" },
  { keys: "/", label: "Search", scope: "Anywhere", action: "palette" },
  { keys: "C", label: "Log work", scope: "Anywhere", action: "commit" },
  { keys: "N", label: "Add task", scope: "Anywhere", action: "capture" },
  { keys: "Z", label: "Undo last", scope: "Anywhere", action: "undo" },
  { keys: "?", label: "Shortcuts", scope: "Anywhere", action: "shortcuts" },
  { keys: "[", label: "Toggle sidebar", scope: "Anywhere" },
  { keys: "G T", label: "Today", scope: "Go to", href: "/platform/today" },
  { keys: "G I", label: "Inbox", scope: "Go to", href: "/platform/inbox" },
  { keys: "G B", label: "Board", scope: "Go to", href: "/platform/board" },
  { keys: "G P", label: "Projects", scope: "Go to", href: "/platform/projects" },
  { keys: "G M", label: "Metrics", scope: "Go to", href: "/platform/metrics" },
  { keys: "G A", label: "Activity", scope: "Go to", href: "/platform/activity" },
  { keys: "G H", label: "History", scope: "Go to", href: "/platform/history" },
  { keys: "G R", label: "Week review", scope: "Go to", href: "/platform/review" },
  { keys: "G S", label: "Settings", scope: "Go to", href: "/platform/settings" },
  { keys: "A", label: "Add to first column", scope: "Board" },
  { keys: "F", label: "Filter", scope: "Board" },
  { keys: "X", label: "Select card", scope: "Board" },
  { keys: "⇧ Click", label: "Select card", scope: "Board" },
  { keys: "J K", label: "Next / previous", scope: "Inbox" },
  { keys: "1", label: "Queue", scope: "Inbox" },
  { keys: "2", label: "Start", scope: "Inbox" },
  { keys: "D", label: "Due date", scope: "Inbox" },
  { keys: "P", label: "Project", scope: "Inbox" },
  { keys: "E", label: "Rename", scope: "Inbox" },
  { keys: "⌫", label: "Delete", scope: "Inbox" },
  { keys: "X", label: "Select", scope: "Inbox" },
  { keys: "J K", label: "Next / previous task", scope: "Task panel" },
  { keys: "Esc", label: "Close", scope: "Task panel" },
];

/** `G <letter>` jumps, keyed by the second letter (lower case). */
export const JUMPS: Record<string, string> = Object.fromEntries(
  SHORTCUTS.filter((s) => s.href && s.keys.startsWith("G ")).map((s) => [s.keys.slice(2).toLowerCase(), s.href as string])
);

/** Single-key global actions, keyed by the key as typed. */
export const ACTION_KEYS: Record<string, ShortcutAction> = Object.fromEntries(
  SHORTCUTS.filter((s) => s.action && s.scope === "Anywhere" && s.keys.length === 1).map((s) => [s.keys.toLowerCase(), s.action as ShortcutAction])
);

/** The shortcut hint for a navigation target, e.g. "G B" for the board. */
export function shortcutFor(href: string): string | undefined {
  return SHORTCUTS.find((s) => s.href === href)?.keys;
}

export const SHORTCUT_SCOPES = ["Anywhere", "Go to", "Board", "Inbox", "Task panel"] as const;

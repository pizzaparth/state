/**
 * Checklists inside a task description: lines that start with "- [ ]" or "- [x]".
 * Ticking one rewrites only that line, so the rest of the text is kept as typed.
 */

const ITEM = /^(\s*[-*] \[)([ xX])(\]\s?)(.*)$/;

export interface ChecklistItem {
  /** Line number in the description. */
  line: number;
  done: boolean;
  text: string;
}

export function checklistItems(text: string | null | undefined): ChecklistItem[] {
  if (!text) return [];
  const items: ChecklistItem[] = [];
  text.split("\n").forEach((raw, line) => {
    const m = raw.match(ITEM);
    if (m) items.push({ line, done: m[2] !== " ", text: m[4] });
  });
  return items;
}

/** `{ done, total }`, or null when there is no checklist. */
export function checklistCount(text: string | null | undefined): { done: number; total: number } | null {
  const items = checklistItems(text);
  return items.length ? { done: items.filter((i) => i.done).length, total: items.length } : null;
}

/** The description with line `line` ticked or unticked. Other lines are untouched. */
export function toggleChecklistLine(text: string, line: number, done: boolean): string {
  const lines = text.split("\n");
  const m = lines[line]?.match(ITEM);
  if (!m) return text;
  lines[line] = `${m[1]}${done ? "x" : " "}${m[3]}${m[4]}`;
  return lines.join("\n");
}

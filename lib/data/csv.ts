/**
 * RFC 4180 CSV for data export and import. Cells that a spreadsheet would run as a
 * formula (leading = + - @, tab or CR) are prefixed with an apostrophe on export, and
 * the apostrophe is removed again on import, so a file round-trips unchanged.
 */

const FORMULA = /^[=+\-@\t\r]/;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<K extends string>(header: readonly K[], rows: Record<K, unknown>[]): string {
  const lines = [header.join(","), ...rows.map((row) => header.map((key) => cell(row[key])).join(","))];
  // CRLF per RFC 4180; Excel opens it as UTF-8 thanks to the byte-order mark
  return `﻿${lines.join("\r\n")}\r\n`;
}

/**
 * Parses CSV text into records keyed by the (lower-cased, trimmed) header row. Returns
 * null when quotes are unbalanced. Blank lines are skipped.
 */
export function parseCsv(text: string): Record<string, string>[] | null {
  const input = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (quoted) return null;
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ""));
  const [header, ...body] = nonEmpty;
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((values) =>
    Object.fromEntries(keys.map((key, i) => [key, unescapeFormula(values[i] ?? "")]))
  );
}

const unescapeFormula = (value: string) => (/^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value);

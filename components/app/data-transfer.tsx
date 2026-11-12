"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TICK } from "@/lib/type";

const EXPORTS = [
  { href: "/api/export?format=json", label: "All · JSON" },
  { href: "/api/export?format=csv&dataset=tasks", label: "Tasks · CSV" },
  { href: "/api/export?format=csv&dataset=commits", label: "Commits · CSV" },
  { href: "/api/export?format=csv&dataset=projects", label: "Projects · CSV" },
] as const;

const MAX_BYTES = 4 * 1024 * 1024;

const button = "app-btn inline-flex h-10 items-center gap-2 rounded-[12px] px-4 text-base font-medium disabled:opacity-70";

/** Export downloads (plain links: the server sets the file name). */
export function ExportLinks() {
  return (
    <ul className="flex flex-wrap gap-2">
      {EXPORTS.map((e) => (
        <li key={e.href}>
          <a href={e.href} download className={button}>
            <Download className="size-4" aria-hidden="true" />
            {e.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

type ImportResult = { projects: number; tasks: number; commits: number; skipped: number };

/**
 * Import from a State JSON export or a tasks / commits / projects CSV. The file goes as
 * the raw body to /api/import; the result (or the first problem, with its row) shows
 * inline.
 */
export function ImportForm() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [status, setStatus] = React.useState<{ kind: "error" | "done"; text: string } | null>(null);
  const [pending, setPending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!file) {
      setStatus({ kind: "error", text: "Choose a .json or .csv file." });
      inputRef.current?.focus();
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus({ kind: "error", text: "Files can be up to 4 MB." });
      inputRef.current?.focus();
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": file.name.toLowerCase().endsWith(".csv") ? "text/csv" : "application/json" },
        body: await file.text(),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; result?: ImportResult };
      if (!response.ok || !body.result) {
        setStatus({ kind: "error", text: body.error ?? "Import failed. Nothing was saved." });
        return;
      }
      const r = body.result;
      const parts = [
        `+${formatNumber(r.tasks)} tasks`,
        `+${formatNumber(r.commits)} commits`,
        `+${formatNumber(r.projects)} projects`,
        r.skipped > 0 && `${formatNumber(r.skipped)} already here`,
      ].filter(Boolean);
      setStatus({ kind: "done", text: parts.join(" · ") });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setStatus({ kind: "error", text: "Network error. Nothing was saved." });
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="app-field relative flex h-10 min-w-0 max-w-full cursor-pointer items-center rounded-[12px] px-3 text-base focus-within:border-black/40">
          <span className="sr-only">Import file</span>
          <input
            ref={inputRef}
            type="file"
            name="file"
            accept=".json,.csv,application/json,text/csv"
            aria-describedby="import-hint import-status"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setStatus(null);
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          <span className={cn("truncate", file ? "text-[#0A0A0A]" : "text-[#71717A]")}>{file ? file.name : "Choose file…"}</span>
        </label>
        <button type="submit" disabled={pending} className={button}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
          Import
        </button>
      </div>
      <p id="import-hint" className={cn(TICK, "text-[#71717A]")}>
        JSON export · CSV of tasks, commits or projects · 4&nbsp;MB
      </p>
      <p id="import-status" aria-live="polite" className={cn("text-sm", status?.kind === "error" ? "text-[#B42318]" : "font-mono tabular-nums text-[#0A0A0A]")}>
        {status?.text}
      </p>
    </form>
  );
}

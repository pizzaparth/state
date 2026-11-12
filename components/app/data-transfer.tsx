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

type ImportResult = { projects: number; tasks: number; commits: number; skipped: number; doneWithoutCommit: number };

const contentType = (name: string) => {
  const n = name.toLowerCase();
  return n.endsWith(".csv") ? "text/csv" : n.endsWith(".txt") ? "text/plain" : "application/json";
};

const summary = (r: ImportResult) =>
  [
    `${formatNumber(r.tasks)} tasks`,
    `${formatNumber(r.commits)} commits`,
    `${formatNumber(r.projects)} projects`,
    r.skipped > 0 && `${formatNumber(r.skipped)} already here`,
  ]
    .filter(Boolean)
    .join(", ");

/**
 * Import from a State JSON export, a tasks / commits / projects CSV, or a .txt list (one
 * task per line, capture rules). Choosing a file runs a dry run first: the counts, or the
 * first ten problems with their rows, show before anything is written.
 */
export function ImportForm() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<{ result: ImportResult; kind: string } | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<{ kind: "error" | "done"; text: string } | null>(null);
  const [pending, setPending] = React.useState<"preview" | "import" | null>(null);

  const send = async (f: File, dry: boolean) => {
    const response = await fetch(`/api/import${dry ? "?dry=1" : ""}`, { method: "POST", headers: { "content-type": contentType(f.name) }, body: await f.text() });
    return { ok: response.ok, body: (await response.json().catch(() => ({}))) as { error?: string; errors?: string[]; result?: ImportResult; kind?: string } };
  };

  const choose = async (f: File | null) => {
    setFile(f);
    setPreview(null);
    setErrors([]);
    setStatus(null);
    if (!f) return;
    if (f.size > MAX_BYTES) return setStatus({ kind: "error", text: "Files can be up to 4 MB." });
    setPending("preview");
    try {
      const { ok, body } = await send(f, true);
      if (!ok || !body.result) {
        setErrors(body.errors?.length ? body.errors : [body.error ?? "This file cannot be imported."]);
        return;
      }
      setPreview({ result: body.result, kind: body.kind ?? "" });
    } catch {
      setStatus({ kind: "error", text: "Network error. Nothing was read." });
    } finally {
      setPending(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!file || !preview) {
      setStatus({ kind: "error", text: "Choose a .json, .csv or .txt file." });
      inputRef.current?.focus();
      return;
    }
    setPending("import");
    try {
      const { ok, body } = await send(file, false);
      if (!ok || !body.result) {
        setStatus({ kind: "error", text: body.error ?? "Import failed. Nothing was saved." });
        return;
      }
      const r = body.result;
      setStatus({
        kind: "done",
        text: `Imported ${summary(r)}.${r.doneWithoutCommit > 0 ? ` ${formatNumber(r.doneWithoutCommit)} done tasks came without a commit: they count for throughput, not execution.` : ""}`,
      });
      setFile(null);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setStatus({ kind: "error", text: "Network error. Nothing was saved." });
    } finally {
      setPending(null);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="app-field relative flex h-10 min-w-0 max-w-full cursor-pointer items-center rounded-[12px] px-3 text-base focus-within:border-accent">
          <span className="sr-only">Import file</span>
          <input
            ref={inputRef}
            type="file"
            name="file"
            accept=".json,.csv,.txt,application/json,text/csv,text/plain"
            aria-describedby="import-hint import-status"
            onChange={(e) => void choose(e.target.files?.[0] ?? null)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          <span className={cn("truncate", file ? "text-[#0A0A0A]" : "text-[#71717A]")}>{file ? file.name : "Choose file…"}</span>
        </label>
        <button type="submit" disabled={pending !== null || !preview} className={button}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
          {pending === "preview" ? "Reading…" : "Import"}
        </button>
      </div>
      <p id="import-hint" className={cn(TICK, "text-[#71717A]")}>
        JSON export · CSV of tasks, commits or projects · .txt list, one task per line · 4&nbsp;MB
      </p>
      <div id="import-status" aria-live="polite" className="text-sm">
        {preview && (
          <p className="font-mono tabular-nums text-[#0A0A0A]">
            {preview.kind}: {summary(preview.result)}
            {preview.result.doneWithoutCommit > 0 && <span className="block text-[#71717A]">{formatNumber(preview.result.doneWithoutCommit)} done tasks without a commit</span>}
          </p>
        )}
        {errors.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-danger">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
        {status && <p className={status.kind === "error" ? "text-danger" : "font-mono tabular-nums text-[#0A0A0A]"}>{status.text}</p>}
      </div>
    </form>
  );
}

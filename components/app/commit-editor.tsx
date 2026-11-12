"use client";

import * as React from "react";
import { Loader2, Pencil } from "lucide-react";
import { editCommitAction } from "@/app/(app)/actions";
import { editCommitSchema } from "@/lib/validation";
import { useNotice } from "./notice";

type FieldName = "message" | "projectId" | "tags";

const selectClass = "app-field h-11 w-full rounded-[14px] bg-white px-3 text-base text-[#0A0A0A] focus:border-black/40 focus:outline-none";

const splitTags = (text: string) =>
  text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/**
 * Edit… for a commit in its panel: message, project and tags. Time and execution are
 * locked and not offered. Escape cancels without closing the panel; ⌘/Ctrl+Enter saves.
 */
export function CommitEditor({
  commit,
  projects,
}: {
  commit: { id: string; message: string; projectId: string | null; projectName: string | null; tags: string[] };
  projects: { id: string; name: string }[];
}) {
  const notify = useNotice();
  const initial = React.useMemo(() => ({ message: commit.message, projectId: commit.projectId ?? "", tags: commit.tags.join(", ") }), [commit]);
  const [editing, setEditing] = React.useState(false);
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<Partial<Record<FieldName | "form", string>>>({});
  const [pending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);
  const editRef = React.useRef<HTMLButtonElement>(null);
  const dirty = editing && JSON.stringify(values) !== JSON.stringify(initial);
  // An archived project stays selectable while it is still the commit's project
  const options = commit.projectId && !projects.some((p) => p.id === commit.projectId) ? [{ id: commit.projectId, name: commit.projectName ?? "Archived project" }, ...projects] : projects;

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  React.useEffect(() => {
    if (editing) formRef.current?.querySelector<HTMLTextAreaElement>('[name="message"]')?.focus();
  }, [editing]);

  const stop = () => {
    setEditing(false);
    setValues(initial);
    setErrors({});
    requestAnimationFrame(() => editRef.current?.focus());
  };

  const set = (field: FieldName, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((x) => ({ ...x, [field]: undefined, form: undefined }));
  };

  if (!editing) {
    return (
      <button ref={editRef} type="button" onClick={() => setEditing(true)} className="app-btn mt-6 inline-flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-sm font-medium">
        <Pencil className="size-4" aria-hidden="true" />
        Edit…
      </button>
    );
  }

  const fieldError = (field: FieldName) =>
    errors[field] && (
      <p id={`commit-${field}-error`} className="text-sm text-[#B42318]">
        {errors[field]}
      </p>
    );

  return (
    <form
      ref={formRef}
      data-drawer-escape
      noValidate
      className="mt-6 space-y-4 border-t border-black/[0.05] pt-5"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          stop();
        }
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const parsed = editCommitSchema.safeParse({ commitId: commit.id, message: values.message, projectId: values.projectId || null, tags: splitTags(values.tags) });
        if (!parsed.success) {
          const next: typeof errors = {};
          for (const issue of parsed.error.issues) next[issue.path[0] as FieldName] ??= issue.message;
          setErrors(next);
          const first = (["message", "projectId", "tags"] as const).find((f) => next[f]);
          if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
          return;
        }
        startTransition(async () => {
          const result = await editCommitAction(parsed.data);
          if (!result.ok) return setErrors({ form: result.error });
          notify("Commit corrected. Time and execution unchanged.");
          setEditing(false);
          requestAnimationFrame(() => editRef.current?.focus());
        });
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor="commit-message" className="text-sm font-medium text-[#52525B]">
          Message
        </label>
        <textarea
          id="commit-message"
          name="message"
          rows={3}
          maxLength={500}
          value={values.message}
          onChange={(e) => set("message", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "commit-message-error" : undefined}
          className="app-input w-full resize-none rounded-[16px] px-4 py-3 text-base"
        />
        {fieldError("message")}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="commit-project" className="text-sm font-medium text-[#52525B]">
          Project
        </label>
        <select
          id="commit-project"
          name="projectId"
          value={values.projectId}
          onChange={(e) => set("projectId", e.target.value)}
          aria-invalid={Boolean(errors.projectId)}
          aria-describedby={errors.projectId ? "commit-projectId-error" : undefined}
          className={selectClass}
        >
          <option value="">No project</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {fieldError("projectId")}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="commit-tags" className="text-sm font-medium text-[#52525B]">
          Tags <span className="text-[#71717A]">(optional)</span>
        </label>
        <input
          id="commit-tags"
          name="tags"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={values.tags}
          onChange={(e) => set("tags", e.target.value)}
          placeholder="research, writing…"
          aria-invalid={Boolean(errors.tags)}
          aria-describedby={errors.tags ? "commit-tags-error" : "commit-tags-hint"}
          className="app-input h-11 w-full rounded-[14px] px-3 text-base"
        />
        {errors.tags ? fieldError("tags") : (
          <p id="commit-tags-hint" className="font-mono text-sm text-[#71717A]">
            comma-separated · up to 10
          </p>
        )}
      </div>

      <p aria-live="polite" className="min-h-5 text-sm text-[#B42318]">
        {errors.form}
      </p>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={stop} className="inline-flex h-11 items-center rounded-[14px] px-4 text-base text-[#52525B] hover:text-[#0A0A0A]">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="app-btn inline-flex h-11 items-center gap-1.5 rounded-[14px] px-5 text-base font-semibold disabled:opacity-60">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save
        </button>
      </div>
    </form>
  );
}

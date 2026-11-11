"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Archive, ArchiveRestore, Loader2, Pencil, Plus } from "lucide-react";
import { createProjectAction, setProjectArchivedAction, updateProjectAction, type ActionResult } from "@/app/(app)/actions";
import { createProjectSchema, PROJECT_DESCRIPTION_MAX, PROJECT_STATUSES, slugify, updateProjectSchema } from "@/lib/validation";
import { useNotice } from "./notice";

type FieldName = "name" | "slug" | "description" | "status";
type Status = (typeof PROJECT_STATUSES)[number];
type Values = { name: string; slug: string; description: string; status: Status };

const STATUS_LABEL: Record<Status, string> = { planned: "Planned", active: "Active", paused: "Paused", completed: "Completed" };

const selectClass =
  "app-field h-11 w-full rounded-[14px] bg-[#000000] px-3 text-base text-[#F2F2EF] focus:border-white/45 focus:outline-none";

/**
 * Project form in a dialog, shared by create and edit. Validates with the server's Zod
 * schema before sending; a slug conflict from the server lands on the slug field.
 */
function ProjectDialog({
  trigger,
  title,
  description,
  initial,
  showStatus,
  submitLabel,
  validate,
  submit,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  initial: Values;
  /** Edit only: new projects start Active. */
  showStatus: boolean;
  submitLabel: string;
  validate: (values: Values) => { success: true } | { success: false; issues: { path: PropertyKey[]; message: string }[] };
  /** Returns an error message, or null once saved (the caller closes and navigates). */
  submit: (values: Values) => Promise<string | null>;
}) {
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState(initial);
  // A new project's slug follows its name until edited; an existing slug never does
  const [slugEdited, setSlugEdited] = React.useState(showStatus);
  const [errors, setErrors] = React.useState<Partial<Record<FieldName | "form", string>>>({});
  const [pending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);
  const dirty = open && JSON.stringify(values) !== JSON.stringify(initial);

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const reset = () => {
    setValues(initial);
    setSlugEdited(showStatus);
    setErrors({});
  };

  const set = (field: FieldName, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((x) => ({ ...x, [field]: undefined, form: undefined }));
  };

  const focusField = (field: FieldName) => formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();

  const fieldProps = (field: FieldName) => ({
    id: `project-${field}`,
    name: field,
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby":
      [errors[field] && `project-${field}-error`, field === "description" && "project-description-count"].filter(Boolean).join(" ") || undefined,
  });

  const fieldError = (field: FieldName) =>
    errors[field] && (
      <p id={`project-${field}-error`} className="text-sm text-[#F0A39B]">
        {errors[field]}
      </p>
    );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Open from the latest saved values; close discards the draft
        reset();
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            // Desktop: focus the name field; leave mobile keyboards closed
            if (!window.matchMedia("(pointer: fine)").matches) e.preventDefault();
          }}
          className="fixed left-1/2 top-[10vh] z-50 max-h-[85vh] w-[min(30rem,calc(100vw-2rem))] origin-top -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[28px] border border-white/10 bg-[#0A0A0A] p-6 outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in"
        >
          <Dialog.Title className="text-lg font-semibold tracking-[-0.01em]">{title}</Dialog.Title>
          <Dialog.Description className="mt-1 text-base text-[#9A9A96]">{description}</Dialog.Description>

          <form
            ref={formRef}
            className="mt-5 space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (pending) return;
              const parsed = validate(values);
              if (!parsed.success) {
                const next: typeof errors = {};
                for (const issue of parsed.issues) {
                  const field = issue.path[0] as FieldName;
                  next[field] ??= issue.message;
                }
                setErrors(next);
                focusField((["name", "slug", "description", "status"] as const).find((f) => next[f]) ?? "name");
                return;
              }
              setErrors({});
              startTransition(async () => {
                const error = await submit(values);
                if (!error) {
                  setOpen(false);
                  return;
                }
                // Slug conflicts name the slug; everything else belongs to the form
                if (error.startsWith("#")) {
                  setErrors({ slug: error });
                  focusField("slug");
                } else setErrors({ form: error });
              });
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="project-name" className="text-sm font-medium text-[#9A9A96]">
                Name
              </label>
              <input
                {...fieldProps("name")}
                autoComplete="off"
                maxLength={100}
                value={values.name}
                onChange={(e) => {
                  set("name", e.target.value);
                  if (!slugEdited) set("slug", slugify(e.target.value));
                }}
                placeholder="Relay DB…"
                className="app-input h-11 w-full rounded-[14px] px-3 text-base"
              />
              {fieldError("name")}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="project-slug" className="text-sm font-medium text-[#9A9A96]">
                Slug
              </label>
              <div className="app-input flex h-11 items-center rounded-[14px] pl-3 focus-within:border-white/45">
                <span aria-hidden="true" className="font-mono text-base text-[#85857F]">
                  #
                </span>
                <input
                  {...fieldProps("slug")}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={100}
                  value={values.slug}
                  onChange={(e) => {
                    set("slug", e.target.value);
                    setSlugEdited(showStatus || e.target.value !== "");
                  }}
                  placeholder="relay-db…"
                  translate="no"
                  className="h-full min-w-0 flex-1 bg-transparent pr-3 font-mono text-base text-[#F2F2EF] placeholder:text-[#85857F] focus:outline-none"
                />
              </div>
              {errors.slug ? (
                fieldError("slug")
              ) : (
                <p className="text-sm text-[#85857F]">
                  {showStatus && values.slug.trim().toLowerCase() !== initial.slug
                    ? `Captures will use #${values.slug.trim().toLowerCase() || "…"} and the project's link changes.`
                    : "Lowercase letters, numbers and hyphens."}
                </p>
              )}
            </div>

            {showStatus && (
              <div className="space-y-1.5">
                <label htmlFor="project-status" className="text-sm font-medium text-[#9A9A96]">
                  Status
                </label>
                <select {...fieldProps("status")} value={values.status} onChange={(e) => set("status", e.target.value)} className={selectClass}>
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                {fieldError("status")}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="project-description" className="text-sm font-medium text-[#9A9A96]">
                Description <span className="text-[#85857F]">(optional)</span>
              </label>
              <textarea
                {...fieldProps("description")}
                rows={3}
                maxLength={PROJECT_DESCRIPTION_MAX}
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
                }}
                placeholder="What this stream of work delivers…"
                className="app-input w-full resize-none rounded-[16px] px-4 py-3 text-base"
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">{fieldError("description")}</div>
                <p id="project-description-count" className="shrink-0 text-sm tabular-nums text-[#85857F]">
                  <span className="sr-only">Characters used: </span>
                  {values.description.length}/{PROJECT_DESCRIPTION_MAX}
                </p>
              </div>
            </div>

            <p aria-live="polite" className="min-h-5 text-sm text-[#F0A39B]">
              {errors.form}
            </p>

            <div className="flex justify-end gap-2">
              <Dialog.Close className="inline-flex h-11 items-center rounded-[14px] px-4 text-base text-[#9A9A96] hover:text-[#F2F2EF]">Cancel</Dialog.Close>
              <button type="submit" disabled={pending} className="app-btn inline-flex h-11 items-center gap-1.5 rounded-[14px] px-5 text-base font-semibold disabled:opacity-60">
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {submitLabel}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const issuesOf = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.success ? ({ success: true } as const) : ({ success: false, issues: result.error?.issues ?? [] } as const);

const errorOf = (result: ActionResult<unknown>) => (result.ok ? null : result.error);

/** "New project…" in the personal workspace. Opens the project once created. */
export function NewProject() {
  const router = useRouter();
  const notify = useNotice();
  const toInput = (v: Values) => ({ name: v.name, slug: v.slug, description: v.description.trim() || null });

  return (
    <ProjectDialog
      trigger={
        <button type="button" className="app-btn inline-flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-sm font-medium text-[#F2F2EF]">
          <Plus className="size-4" aria-hidden="true" />
          New project…
        </button>
      }
      title="New project"
      description={
        <>
          Tasks join it with <span className="font-mono">#slug</span> when you capture them.
        </>
      }
      initial={{ name: "", slug: "", description: "", status: "active" }}
      showStatus={false}
      submitLabel="Create project"
      validate={(v) => issuesOf(createProjectSchema.safeParse(toInput(v)))}
      submit={async (v) => {
        const result = await createProjectAction(toInput(v));
        if (result.ok) {
          notify(`Created ${v.name.trim()}. Capture to it with #${result.data.slug}.`);
          router.push(result.data.href as Route);
        }
        return errorOf(result);
      }}
    />
  );
}

/**
 * Edit… and Archive / Unarchive for a project page. Archiving offers Undo; a slug change
 * moves to the project's new URL.
 */
export function ProjectActions({
  project,
}: {
  project: { id: string; name: string; slug: string; description: string | null; status: string; archived: boolean };
}) {
  const router = useRouter();
  const notify = useNotice();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const status = ((PROJECT_STATUSES as readonly string[]).includes(project.status) ? project.status : "active") as Status;
  const toInput = (v: Values) => ({ projectId: project.id, name: v.name, slug: v.slug, description: v.description.trim() || null, status: v.status });

  const archive = (archived: boolean) =>
    startTransition(async () => {
      const result = await setProjectArchivedAction({ projectId: project.id, archived });
      if (!result.ok) return setError(result.error);
      setError(null);
      if (archived) {
        notify(`Archived ${project.name}.`, {
          label: "Undo",
          run: async () => {
            const undone = await setProjectArchivedAction({ projectId: project.id, archived: false });
            notify(undone.ok ? `Restored ${project.name}.` : undone.error);
          },
        });
      } else notify(`Restored ${project.name}.`);
    });

  return (
    <div className="flex flex-col items-start gap-1 md:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <ProjectDialog
          trigger={
            <button type="button" className="app-btn inline-flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-sm font-medium">
              <Pencil className="size-4" aria-hidden="true" />
              Edit…
            </button>
          }
          title="Edit project"
          description="Name, #slug, status and description. History and commits stay as they are."
          initial={{ name: project.name, slug: project.slug, description: project.description ?? "", status }}
          showStatus
          submitLabel="Save changes"
          validate={(v) => issuesOf(updateProjectSchema.safeParse(toInput(v)))}
          submit={async (v) => {
            const result = await updateProjectAction(toInput(v));
            if (result.ok) {
              notify("Project saved.");
              if (result.data.slug !== project.slug) router.replace(result.data.href as Route);
            }
            return errorOf(result);
          }}
        />
        <button
          type="button"
          onClick={() => archive(!project.archived)}
          disabled={pending}
          className="app-btn inline-flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-sm font-medium disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : project.archived ? (
            <ArchiveRestore className="size-4" aria-hidden="true" />
          ) : (
            <Archive className="size-4" aria-hidden="true" />
          )}
          {project.archived ? "Unarchive" : "Archive"}
        </button>
      </div>
      <p aria-live="polite" className="text-sm text-[#F0A39B]">
        {error}
      </p>
    </div>
  );
}

"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Archive, Loader2, Plus } from "lucide-react";
import { createObjectiveAction, setObjectiveArchivedAction, setObjectiveProgressAction } from "@/app/(app)/actions";
import { createObjectiveSchema, OBJECTIVE_MEASURES } from "@/lib/validation";
import { useNotice } from "./notice";

type Measure = (typeof OBJECTIVE_MEASURES)[number];
type FieldName = "name" | "measure" | "unit" | "targetValue" | "deadline" | "projectId";

const inputClass = "app-input h-11 w-full rounded-[14px] px-3 text-base";

const empty = { name: "", measure: "manual" as Measure, unit: "", targetValue: "", deadline: "", projectId: "" };

/** "New objective…": a measurable target, counted by hand or summed from commit execution. */
export function NewObjective({ projects }: { projects: { id: string; name: string }[] }) {
  const notify = useNotice();
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState(empty);
  const [errors, setErrors] = React.useState<Partial<Record<FieldName | "form", string>>>({});
  const [pending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);
  const dirty = open && JSON.stringify(values) !== JSON.stringify(empty);

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (field: FieldName, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((x) => ({ ...x, [field]: undefined, form: undefined }));
  };
  const props = (field: FieldName) => ({
    id: `objective-${field}`,
    name: field,
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `objective-${field}-error` : undefined,
  });
  const fieldError = (field: FieldName) =>
    errors[field] && (
      <p id={`objective-${field}-error`} className="text-sm text-danger">
        {errors[field]}
      </p>
    );
  const label = (field: FieldName, text: string, optional = false) => (
    <label htmlFor={`objective-${field}`} className="text-sm font-medium text-[#52525B]">
      {text} {optional && <span className="text-[#71717A]">(optional)</span>}
    </label>
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setValues(empty);
        setErrors({});
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className="app-btn inline-flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-sm font-medium text-[#0A0A0A]">
          <Plus className="size-4" aria-hidden="true" />
          New objective…
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 app-scrim data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            if (!window.matchMedia("(pointer: fine)").matches) e.preventDefault();
          }}
          className="fixed left-1/2 top-[8vh] z-50 max-h-[88vh] w-[min(30rem,calc(100vw-2rem))] origin-top -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[28px] border border-black/[0.06] bg-white p-6 outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in"
        >
          <Dialog.Title className="text-lg font-semibold tracking-[-0.01em]">New objective</Dialog.Title>
          <Dialog.Description className="mt-1 font-mono text-sm text-[#71717A]">status = velocity vs required velocity</Dialog.Description>

          <form
            ref={formRef}
            noValidate
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (pending) return;
              const input = {
                name: values.name,
                measure: values.measure,
                unit: values.measure === "execution" ? "" : values.unit,
                targetValue: values.targetValue.trim() === "" ? NaN : Number(values.targetValue),
                deadline: values.deadline || null,
                projectId: values.projectId || null,
              };
              const parsed = createObjectiveSchema.safeParse(input);
              if (!parsed.success) {
                const next: typeof errors = {};
                for (const issue of parsed.error.issues) next[issue.path[0] as FieldName] ??= issue.message;
                setErrors(next);
                const first = (["name", "unit", "targetValue", "deadline", "projectId"] as const).find((f) => next[f]);
                if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
                return;
              }
              startTransition(async () => {
                const result = await createObjectiveAction(parsed.data);
                if (!result.ok) return setErrors({ form: result.error });
                setOpen(false);
                notify(`Tracking “${parsed.data.name}”.`);
              });
            }}
          >
            <div className="space-y-1.5">
              {label("name", "Name")}
              <input {...props("name")} autoComplete="off" maxLength={100} value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="Learn machine learning…" className={inputClass} />
              {fieldError("name")}
            </div>

            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium text-[#52525B]">Measure</legend>
              <div className="app-field grid grid-cols-2 gap-1 rounded-[14px] p-1">
                {(
                  [
                    ["manual", "Count by hand"],
                    ["execution", "Execution"],
                  ] as const
                ).map(([value, text]) => (
                  <label
                    key={value}
                    className={`flex h-9 cursor-pointer items-center justify-center rounded-[10px] text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-accent ${values.measure === value ? "bg-[#0A0A0A] text-white" : "text-[#52525B] hover:text-[#0A0A0A]"}`}
                  >
                    <input type="radio" name="measure" value={value} checked={values.measure === value} onChange={() => set("measure", value)} className="sr-only" />
                    {text}
                  </label>
                ))}
              </div>
              <p className="font-mono text-sm text-[#71717A]">{values.measure === "execution" ? "current = Σ commit execution since today" : "current = the count you enter"}</p>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                {label("targetValue", "Target")}
                <input {...props("targetValue")} inputMode="numeric" autoComplete="off" value={values.targetValue} onChange={(e) => set("targetValue", e.target.value)} placeholder="42…" className={`${inputClass} tabular-nums`} />
                {fieldError("targetValue")}
              </div>
              {values.measure === "manual" && (
                <div className="space-y-1.5">
                  {label("unit", "Unit")}
                  <input {...props("unit")} autoComplete="off" maxLength={24} value={values.unit} onChange={(e) => set("unit", e.target.value)} placeholder="modules…" className={inputClass} />
                  {fieldError("unit")}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              {label("deadline", "Deadline", true)}
              <input {...props("deadline")} type="date" value={values.deadline} onChange={(e) => set("deadline", e.target.value)} className={`${inputClass} [color-scheme:light]`} />
              {fieldError("deadline")}
            </div>

            {projects.length > 0 && (
              <div className="space-y-1.5">
                {label("projectId", "Project", true)}
                <select {...props("projectId")} value={values.projectId} onChange={(e) => set("projectId", e.target.value)} className="app-select">
                  <option value="">Whole workspace</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {fieldError("projectId")}
              </div>
            )}

            <p aria-live="polite" className="min-h-5 text-sm text-danger">
              {errors.form}
            </p>
            <div className="flex justify-end gap-2">
              <Dialog.Close className="inline-flex h-11 items-center rounded-[14px] px-4 text-base text-[#52525B] hover:text-[#0A0A0A]">Cancel</Dialog.Close>
              <button type="submit" disabled={pending} className="app-btn inline-flex h-11 items-center gap-1.5 rounded-[14px] px-5 text-base font-semibold disabled:opacity-60">
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Create objective
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Current value of a hand-counted objective; Enter saves. */
export function ObjectiveProgress({ objectiveId, name, value, unit }: { objectiveId: string; name: string; value: number; unit: string }) {
  const notify = useNotice();
  const [draft, setDraft] = React.useState(String(value));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [serverValue, setServerValue] = React.useState(value);
  if (value !== serverValue) {
    setServerValue(value);
    if (!pending) setDraft(String(value));
  }
  const id = `objective-progress-${objectiveId}`;

  return (
    <form
      noValidate
      className="flex flex-col items-start gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const next = draft.trim() === "" ? NaN : Number(draft);
        if (!Number.isInteger(next) || next < 0) return setError("Enter a whole number.");
        if (next === value || pending) return;
        startTransition(async () => {
          const result = await setObjectiveProgressAction({ objectiveId, currentValue: next });
          if (!result.ok) return setError(result.error);
          setError(null);
          notify(result.data.completed ? `“${name}” reached its target.` : `${name}: ${next} ${unit}.`);
        });
      }}
    >
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="sr-only">
          Current {unit} for {name}
        </label>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={draft}
          onChange={(e) => (setDraft(e.target.value), setError(null))}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="app-input h-9 w-20 rounded-[12px] px-2.5 text-base tabular-nums"
        />
        <button type="submit" disabled={pending} className="app-btn inline-flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-sm font-medium disabled:opacity-60">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Update
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} aria-live="polite" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

/** Archive with Undo. */
export function ArchiveObjective({ objectiveId, name }: { objectiveId: string; name: string }) {
  const notify = useNotice();
  const [pending, startTransition] = React.useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Archive ${name}`}
      title="Archive"
      onClick={() =>
        startTransition(async () => {
          const result = await setObjectiveArchivedAction({ objectiveId, archived: true });
          if (!result.ok) return notify(result.error);
          notify(`Archived “${name}”.`, {
            label: "Undo",
            run: async () => {
              const undone = await setObjectiveArchivedAction({ objectiveId, archived: false });
              notify(undone.ok ? `Restored “${name}”.` : undone.error);
            },
          });
        })
      }
      className="app-btn grid size-9 place-items-center rounded-full disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Archive className="size-4" aria-hidden="true" />}
    </button>
  );
}

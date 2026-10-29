"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Loader2, Plus } from "lucide-react";
import { createOrganisationAction } from "@/app/(app)/actions";
import { createOrganisationSchema, slugify } from "@/lib/validation";
import { useNotice } from "./notice";

type FieldName = "name" | "slug";

/**
 * "New organisation…": name and address. Validates with the server's Zod schema before
 * sending; a taken address from the server lands on the slug field. Opens the new
 * organisation once created, unless `openAfter` is false (first-run setup stays put).
 */
export function NewOrganisation({ openAfter = true }: { openAfter?: boolean } = {}) {
  const router = useRouter();
  const notify = useNotice();
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState({ name: "", slug: "" });
  // The address follows the name until edited
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<FieldName | "form", string>>>({});
  const [pending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);
  const dirty = open && (values.name !== "" || values.slug !== "");

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

  const focusField = (field: FieldName) => formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();

  const fieldProps = (field: FieldName) => ({
    id: `organisation-${field}`,
    name: field,
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `organisation-${field}-error` : field === "slug" ? "organisation-slug-hint" : undefined,
  });

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setValues({ name: "", slug: "" });
        setSlugEdited(false);
        setErrors({});
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className="app-btn inline-flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-sm font-medium text-[#F2F2EF]">
          <Plus className="size-4" aria-hidden="true" />
          New organisation…
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            // Desktop: focus the name field; leave mobile keyboards closed
            if (!window.matchMedia("(pointer: fine)").matches) e.preventDefault();
          }}
          className="fixed left-1/2 top-[10vh] z-50 max-h-[85vh] w-[min(30rem,calc(100vw-2rem))] origin-top -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[28px] border border-white/10 bg-[#0A0A0A] p-6 outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in"
        >
          <Dialog.Title className="text-lg font-semibold tracking-[-0.01em]">New organisation</Dialog.Title>
          <Dialog.Description className="mt-1 text-base text-[#9A9A96]">A shared board, projects and metrics. You are the owner.</Dialog.Description>

          <form
            ref={formRef}
            className="mt-5 space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (pending) return;
              const parsed = createOrganisationSchema.safeParse(values);
              if (!parsed.success) {
                const next: typeof errors = {};
                for (const issue of parsed.error.issues) next[issue.path[0] as FieldName] ??= issue.message;
                setErrors(next);
                focusField(next.name ? "name" : "slug");
                return;
              }
              setErrors({});
              startTransition(async () => {
                const result = await createOrganisationAction(parsed.data);
                if (result.ok) {
                  setOpen(false);
                  notify(`Created ${parsed.data.name}.`);
                  if (openAfter) router.push(result.data.href as Route);
                  else router.refresh();
                  return;
                }
                if (result.error.includes("taken")) {
                  setErrors({ slug: result.error });
                  focusField("slug");
                } else setErrors({ form: result.error });
              });
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="organisation-name" className="text-sm font-medium text-[#9A9A96]">
                Name
              </label>
              <input
                {...fieldProps("name")}
                autoComplete="organization"
                maxLength={80}
                value={values.name}
                onChange={(e) => {
                  set("name", e.target.value);
                  if (!slugEdited) set("slug", slugify(e.target.value).slice(0, 48).replace(/-+$/, ""));
                }}
                placeholder="Ksan Relay…"
                className="app-input h-11 w-full rounded-[14px] px-3 text-base"
              />
              {errors.name && (
                <p id="organisation-name-error" className="text-sm text-[#F0A39B]">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="organisation-slug" className="text-sm font-medium text-[#9A9A96]">
                Address
              </label>
              <div className="app-input flex h-11 items-center rounded-[14px] pl-3 focus-within:border-white/45">
                <span aria-hidden="true" className="shrink-0 font-mono text-base text-[#85857F]">
                  /org/
                </span>
                <input
                  {...fieldProps("slug")}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={48}
                  value={values.slug}
                  onChange={(e) => {
                    set("slug", e.target.value);
                    setSlugEdited(e.target.value !== "");
                  }}
                  placeholder="ksan-relay…"
                  translate="no"
                  className="h-full min-w-0 flex-1 bg-transparent pr-3 font-mono text-base text-[#F2F2EF] placeholder:text-[#85857F] focus:outline-none"
                />
              </div>
              {errors.slug ? (
                <p id="organisation-slug-error" className="text-sm text-[#F0A39B]">
                  {errors.slug}
                </p>
              ) : (
                <p id="organisation-slug-hint" className="text-sm text-[#85857F]">
                  Lowercase letters, numbers and hyphens.
                </p>
              )}
            </div>

            <p aria-live="polite" className="min-h-5 text-sm text-[#F0A39B]">
              {errors.form}
            </p>

            <div className="flex justify-end gap-2">
              <Dialog.Close className="inline-flex h-11 items-center rounded-[14px] px-4 text-base text-[#9A9A96] hover:text-[#F2F2EF]">Cancel</Dialog.Close>
              <button type="submit" disabled={pending} className="app-btn inline-flex h-11 items-center gap-1.5 rounded-[14px] px-5 text-base font-semibold disabled:opacity-60">
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Create organisation
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

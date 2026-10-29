"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Loader2, Plus } from "lucide-react";
import { createProjectAction } from "@/app/(app)/actions";
import { createProjectSchema, slugify } from "@/lib/validation";
import { useNotice } from "./notice";

type FieldName = "name" | "slug" | "description";

/**
 * "New project…" button and dialog for one workspace (personal when organisationId is
 * null). The slug follows the name until edited by hand; creating opens the project.
 */
export function NewProject({ organisationId, workspaceName }: { organisationId: string | null; workspaceName: string }) {
  const router = useRouter();
  const notify = useNotice();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<FieldName | "form", string>>>({});
  const [pending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);
  const dirty = open && (name.trim() !== "" || slug.trim() !== "");

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const reset = () => {
    setName("");
    setSlug("");
    setSlugEdited(false);
    setErrors({});
  };

  const focusField = (field: FieldName) => formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();

  const fieldProps = (field: FieldName) => ({
    id: `project-${field}`,
    name: field,
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `project-${field}-error` : undefined,
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
        if (!next) reset();
      }}
    >
      <Dialog.Trigger className="app-btn inline-flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-sm font-medium text-[#F2F2EF]">
        <Plus className="size-4" aria-hidden="true" />
        New project…
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            // Desktop: focus the name field; leave mobile keyboards closed
            if (!window.matchMedia("(pointer: fine)").matches) e.preventDefault();
          }}
          className="fixed left-1/2 top-[14vh] z-50 max-h-[80vh] w-[min(30rem,calc(100vw-2rem))] origin-top -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[28px] border border-white/10 bg-[#0A0A0A] p-6 outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in"
        >
          <Dialog.Title className="text-lg font-semibold tracking-[-0.01em]">New project</Dialog.Title>
          <Dialog.Description className="mt-1 text-base text-[#9A9A96]">
            In <span className="text-[#F2F2EF]">{workspaceName}</span>. Tasks join it with <span className="font-mono">#slug</span> when you capture them.
          </Dialog.Description>

          <form
            ref={formRef}
            className="mt-5 space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (pending) return;
              const description = String(new FormData(e.currentTarget).get("description") ?? "").trim();
              const parsed = createProjectSchema.safeParse({ organisationId, name, slug, description: description || null });
              if (!parsed.success) {
                const next: typeof errors = {};
                for (const issue of parsed.error.issues) {
                  const field = issue.path[0] as FieldName;
                  next[field] ??= issue.message;
                }
                setErrors(next);
                focusField((["name", "slug", "description"] as const).find((f) => next[f]) ?? "name");
                return;
              }
              setErrors({});
              startTransition(async () => {
                const result = await createProjectAction(parsed.data);
                if (!result.ok) {
                  // Slug conflicts name the slug; everything else belongs to the form
                  if (result.error.startsWith("#")) {
                    setErrors({ slug: result.error });
                    focusField("slug");
                  } else setErrors({ form: result.error });
                  return;
                }
                setOpen(false);
                reset();
                notify(`Created ${parsed.data.name}. Capture to it with #${result.data.slug}.`);
                router.push(result.data.href as Route);
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
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugEdited) setSlug(slugify(e.target.value));
                  setErrors((x) => ({ ...x, name: undefined, form: undefined }));
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
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugEdited(e.target.value !== "");
                    setErrors((x) => ({ ...x, slug: undefined, form: undefined }));
                  }}
                  placeholder="relay-db…"
                  translate="no"
                  className="h-full min-w-0 flex-1 bg-transparent pr-3 font-mono text-base text-[#F2F2EF] placeholder:text-[#85857F] focus:outline-none"
                />
              </div>
              {errors.slug ? fieldError("slug") : <p className="text-sm text-[#85857F]">Lowercase letters, numbers and hyphens.</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="project-description" className="text-sm font-medium text-[#9A9A96]">
                Description <span className="text-[#85857F]">(optional)</span>
              </label>
              <textarea
                {...fieldProps("description")}
                rows={3}
                maxLength={2000}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
                }}
                placeholder="What this stream of work delivers…"
                className="app-input w-full resize-none rounded-[16px] px-4 py-3 text-base"
              />
              {fieldError("description")}
            </div>

            <p aria-live="polite" className="min-h-5 text-sm text-[#F0A39B]">
              {errors.form}
            </p>

            <div className="flex justify-end gap-2">
              <Dialog.Close className="inline-flex h-11 items-center rounded-[14px] px-4 text-base text-[#9A9A96] hover:text-[#F2F2EF]">Cancel</Dialog.Close>
              <button
                type="submit"
                disabled={pending}
                className="app-btn inline-flex h-11 items-center gap-1.5 rounded-[14px] px-5 text-base font-semibold disabled:opacity-60"
              >
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Create project
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

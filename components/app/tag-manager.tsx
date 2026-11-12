"use client";

import * as React from "react";
import { deleteTagAction, mergeTagsAction, renameTagAction } from "@/app/(app)/client-actions";
import { useNotice } from "./notice";
import { PromptDialog } from "./prompt-dialog";

type TagRow = { id: string; name: string; tasks: number; commits: number };

/** Rename, merge into another, or delete each tag. */
export function TagManager({ tags }: { tags: TagRow[] }) {
  const notify = useNotice();
  const [dialog, setDialog] = React.useState<{ kind: "rename" | "merge"; tag: TagRow } | null>(null);
  const [pending, startTransition] = React.useTransition();
  if (tags.length === 0) return <p className="font-mono text-sm text-[#71717A]">No tags</p>;
  return (
    <>
      <ul className="divide-y divide-black/[0.05]">
        {tags.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block truncate font-medium">{t.name}</span>
              <span className="block font-mono text-[12px] tabular-nums text-[#71717A]">
                {t.tasks} tasks · {t.commits} commits
              </span>
            </span>
            <span className="flex gap-1.5">
              <button type="button" onClick={() => setDialog({ kind: "rename", tag: t })} className="app-btn h-9 rounded-[10px] px-3 text-sm font-medium">
                Rename…
              </button>
              <button type="button" disabled={tags.length < 2} onClick={() => setDialog({ kind: "merge", tag: t })} className="app-btn h-9 rounded-[10px] px-3 text-sm font-medium disabled:opacity-50">
                Merge…
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await deleteTagAction({ tagId: t.id });
                    notify(r.ok ? `Deleted tag “${r.data.name}”.` : r.error);
                  })
                }
                className="app-btn h-9 rounded-[10px] px-3 text-sm font-medium text-danger disabled:opacity-50"
              >
                Delete
              </button>
            </span>
          </li>
        ))}
      </ul>
      <PromptDialog
        open={dialog?.kind === "rename"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Rename “${dialog?.tag.name ?? ""}”`}
        label="Name"
        initial={dialog?.tag.name ?? ""}
        onSubmit={async (name) => {
          const r = await renameTagAction({ tagId: dialog!.tag.id, name });
          if (r.ok) notify(`Renamed to “${r.data.name}”.`);
          return r.ok ? null : r.error;
        }}
      />
      <PromptDialog
        open={dialog?.kind === "merge"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Merge “${dialog?.tag.name ?? ""}” into…`}
        label="Tag to keep"
        initial=""
        placeholder={tags.find((t) => t.id !== dialog?.tag.id)?.name ?? ""}
        hint={`tasks and commits move over; “${dialog?.tag.name ?? ""}” is deleted`}
        submitLabel="Merge"
        onSubmit={async (name) => {
          const into = tags.find((t) => t.name === name.trim().toLowerCase() && t.id !== dialog!.tag.id);
          if (!into) return "Type the name of another existing tag.";
          const r = await mergeTagsAction({ fromTagId: dialog!.tag.id, intoTagId: into.id });
          if (r.ok) notify(`Merged into “${r.data.into}”.`);
          return r.ok ? null : r.error;
        }}
      />
    </>
  );
}

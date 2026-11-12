"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Undo2 } from "lucide-react";
import { restoreCommitAction, restoreTaskAction, setObjectiveArchivedAction, withdrawCommitAction } from "@/app/(app)/client-actions";
import { useNotice } from "./notice";
import { useClosePanel } from "./detail-drawer";

/** Withdraw a mistaken manual commit (author, within 24 hours), with Undo. */
export function WithdrawCommit({ commitId, hoursLeft }: { commitId: string; hoursLeft: number }) {
  const notify = useNotice();
  const close = useClosePanel();
  const [pending, startTransition] = React.useTransition();
  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await withdrawCommitAction({ commitId });
            if (!r.ok) return notify(r.error);
            close();
            notify(`Withdrew “${r.data.message}” −${r.data.executionValue}.`, {
              label: "Undo",
              run: async () => {
                const back = await restoreCommitAction({ commitId });
                notify(back.ok ? `Restored “${back.data.message}”.` : back.error);
              },
            });
          })
        }
        className="app-btn mi-press inline-flex h-10 items-center gap-1.5 rounded-[12px] px-4 text-sm font-medium text-danger disabled:opacity-60"
      >
        {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Undo2 aria-hidden="true" className="size-4" />}
        Withdraw commit
      </button>
      <p className="mt-1.5 font-mono text-[12px] text-[#71717A]">logged by mistake · {Math.max(1, Math.ceil(hoursLeft))}h left to withdraw</p>
    </div>
  );
}

/** Restore button for a deleted task (Settings → Data) or an archived objective (Metrics). */
export function RestoreButton({ kind, id, name }: { kind: "task" | "objective"; id: string; name: string }) {
  const notify = useNotice();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Restore “${name}”`}
      onClick={() =>
        startTransition(async () => {
          const r = kind === "task" ? await restoreTaskAction({ taskId: id }) : await setObjectiveArchivedAction({ objectiveId: id, archived: false });
          notify(r.ok ? `Restored “${name}”.` : r.error);
          if (r.ok) router.refresh();
        })
      }
      className="app-btn mi-press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium disabled:opacity-60"
    >
      {pending ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <RotateCcw aria-hidden="true" className="size-3.5" />}
      Restore
    </button>
  );
}

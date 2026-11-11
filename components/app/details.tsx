import * as React from "react";
import type { getCommitDetail, getTaskDetail } from "@/db/queries";
import { dueState, formatDateTime, formatDuration } from "@/lib/format";
import { weightLabel } from "@/lib/weights";
import { cn } from "@/lib/utils";
import { Chip, DISPLAY, DueLabel, PriorityMark, TICK } from "./primitives";
import { TaskPriority, TaskRecurrence, TaskWeight } from "./task-fields";
import { recurrenceLabel } from "@/lib/recurrence";
import { TaskTitle } from "./task-title";
import { CommitEditor } from "./commit-editor";

type Task = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;
type Commit = NonNullable<Awaited<ReturnType<typeof getCommitDetail>>>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-3 border-t border-white/[0.08] py-2.5 text-base">
      <dt className={cn(TICK, "text-[11px] text-[#85857F]")}>{label}</dt>
      <dd className="min-w-0 break-words font-medium text-[#F2F2EF]">{children}</dd>
    </div>
  );
}

export function TaskDetail({ task, tz, now, editable = false }: { task: Task; tz: string; now: Date; editable?: boolean }) {
  const state = task.completedAt ? "Done" : (task.columnName ?? "Inbox");
  return (
    <div>
      <TaskTitle taskId={task.id} title={task.title} editable={editable} />
      {/* Quant strip: what this task is worth and where it stands */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-y border-white/[0.08] py-4">
        <p className="flex items-baseline gap-2">
          <span className={cn(DISPLAY, "text-5xl leading-none tabular-nums")}>+{task.weight}</span>
          <span className={cn(TICK, "text-[11px] text-[#85857F]")}>{task.completedAt ? "earned" : "on done"}</span>
        </p>
        <p className="flex flex-wrap items-center justify-end gap-2">
          <Chip>{state}</Chip>
          {task.tags.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </p>
      </div>
      {task.description && <p className="app-field mt-5 rounded-[16px] p-4 text-base leading-relaxed text-[#D4D4D0]">{task.description}</p>}

      <dl className="mt-6">
        <Field label="Project">{task.projectName ?? "—"}</Field>
        <Field label="Board">{task.boardName ?? "Inbox"}</Field>
        <Field label="Owner">{task.assigneeName ?? "—"}</Field>
        <Field label="By">{task.creatorName}</Field>
        <Field label="Priority">
          {editable ? (
            <TaskPriority taskId={task.id} priority={task.priority} />
          ) : task.priority === "none" ? (
            "—"
          ) : (
            <PriorityMark priority={task.priority} />
          )}
        </Field>
        <Field label="Weight">
          {editable && !task.completedAt ? (
            <TaskWeight taskId={task.id} weight={task.weight} />
          ) : (
            <>
              {weightLabel(task.weight)} <span className="tabular-nums text-[#9A9A96]">({task.weight} execution)</span>
            </>
          )}
        </Field>
        <Field label="Due">{task.dueAt ? <DueLabel due={dueState(task.dueAt, now, tz)} /> : "—"}</Field>
        <Field label="Repeats">
          {editable && !task.completedAt ? (
            <TaskRecurrence taskId={task.id} rule={task.recurrenceRule} />
          ) : task.recurrenceRule ? (
            recurrenceLabel(task.recurrenceRule)
          ) : (
            "—"
          )}
        </Field>
        <Field label="Created">{formatDateTime(task.createdAt, tz)}</Field>
        <Field label="Started">{task.startedAt ? formatDateTime(task.startedAt, tz) : "—"}</Field>
        <Field label="Done">{task.completedAt ? formatDateTime(task.completedAt, tz) : "—"}</Field>
        {task.startedAt && task.completedAt && (
          <Field label="Cycle">
            <span className="tabular-nums">{formatDuration(task.completedAt.getTime() - task.startedAt.getTime())}</span>
          </Field>
        )}
      </dl>

      <div className="mt-6">
        <p className={cn(TICK, "text-[#9A9A96]")}>Commit</p>
        {task.commit ? (
          <p className="mt-3 flex items-center gap-3 text-base">
            <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
            <span className="min-w-0 flex-1 truncate">{task.commit.message}</span>
            <span className="font-mono text-sm tabular-nums">+{task.commit.executionValue}</span>
          </p>
        ) : (
          <p className="mt-2 font-mono text-sm text-[#85857F]">auto-logged on Done</p>
        )}
      </div>
    </div>
  );
}

const SOURCE: Record<string, string> = {
  task_completion: "Task done",
  manual: "Manual",
  imported: "Imported",
  integration: "Integration",
};

/** `projects` (the commit's workspace) is passed only when the viewer may correct this commit. */
export function CommitDetail({ commit, tz, projects }: { commit: Commit; tz: string; projects?: { id: string; name: string }[] }) {
  return (
    <div>
      <p className="flex items-center gap-3">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-accent" />
        <span className="font-mono text-sm tabular-nums text-[#9A9A96]">{formatDateTime(commit.createdAt, tz)}</span>
      </p>
      <h2 className="mt-3 break-words font-display text-2xl font-bold leading-tight tracking-[-0.02em] [font-stretch:110%] text-[#F2F2EF]">{commit.message}</h2>
      <div className="app-inverse mt-5 flex items-baseline justify-between rounded-[20px] px-5 py-4">
        <span className={cn(TICK, "text-accent-muted")}>Execution</span>
        <span className={cn(DISPLAY, "text-5xl leading-none tabular-nums")}>+{commit.executionValue}</span>
      </div>
      {commit.tags.length > 0 && (
        <p className="mt-4 flex flex-wrap gap-2">
          {commit.tags.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </p>
      )}
      <dl className="mt-6">
        <Field label="Author">{commit.authorName}</Field>
        <Field label="Project">{commit.projectName ?? "—"}</Field>
        <Field label="Source">{SOURCE[commit.source] ?? commit.source}</Field>
        {commit.taskTitle && <Field label="Task">{commit.taskTitle}</Field>}
        {commit.taskCreatedAt && <Field label="Created">{formatDateTime(commit.taskCreatedAt, tz)}</Field>}
        {commit.taskStartedAt && <Field label="Started">{formatDateTime(commit.taskStartedAt, tz)}</Field>}
        {commit.taskStartedAt && commit.taskCompletedAt && (
          <Field label="Cycle">
            <span className="tabular-nums">{formatDuration(commit.taskCompletedAt.getTime() - commit.taskStartedAt.getTime())}</span>
          </Field>
        )}
      </dl>
      <p className="mt-6 font-mono text-[12px] text-[#85857F]">time + value locked · message, project, tags fixable</p>
      {projects && <CommitEditor commit={commit} projects={projects} />}
    </div>
  );
}

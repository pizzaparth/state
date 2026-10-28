import * as React from "react";
import type { getCommitDetail, getTaskDetail } from "@/db/queries";
import { dueState, formatDateTime, formatDuration } from "@/lib/format";
import { Chip, DueLabel, PriorityMark } from "./primitives";

type Task = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;
type Commit = NonNullable<Awaited<ReturnType<typeof getCommitDetail>>>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 border-t border-black/[0.06] py-2.5 text-sm">
      <dt className="text-[#5F5F5B]">{label}</dt>
      <dd className="min-w-0 break-words text-[#171717]">{children}</dd>
    </div>
  );
}

const WEIGHT: Record<number, string> = { 1: "Small", 2: "Normal", 4: "Major", 8: "Milestone" };

export function TaskDetail({ task, tz, now }: { task: Task; tz: string; now: Date }) {
  const state = task.completedAt ? "Done" : (task.columnName ?? "Inbox");
  return (
    <div>
      <h2 className="text-xl font-semibold leading-snug tracking-[-0.01em] text-[#171717]">{task.title}</h2>
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <Chip>{state}</Chip>
        {task.tags.map((t) => (
          <Chip key={t}>{t}</Chip>
        ))}
      </p>
      {task.description && <p className="neu-inset mt-5 rounded-[16px] p-4 text-sm leading-relaxed text-[#3A3A38]">{task.description}</p>}

      <dl className="mt-6">
        <Field label="Project">{task.projectName ?? "None"}</Field>
        <Field label="Board">{task.boardName ?? "Inbox"}</Field>
        <Field label="Assignee">{task.assigneeName ?? "Unassigned"}</Field>
        <Field label="Creator">{task.creatorName}</Field>
        <Field label="Priority">
          {task.priority === "none" ? "None" : <PriorityMark priority={task.priority} />}{" "}
          <span className="text-[#5F5F5B]">{task.priority !== "none" && task.priority}</span>
        </Field>
        <Field label="Weight">
          {WEIGHT[task.weight]} <span className="tabular-nums text-[#5F5F5B]">({task.weight} execution)</span>
        </Field>
        <Field label="Due">{task.dueAt ? <DueLabel due={dueState(task.dueAt, now, tz)} /> : "No due date"}</Field>
        <Field label="Created">{formatDateTime(task.createdAt, tz)}</Field>
        <Field label="Started">{task.startedAt ? formatDateTime(task.startedAt, tz) : "Not started"}</Field>
        <Field label="Completed">{task.completedAt ? formatDateTime(task.completedAt, tz) : "Open"}</Field>
        {task.startedAt && task.completedAt && (
          <Field label="Cycle time">
            <span className="tabular-nums">{formatDuration(task.completedAt.getTime() - task.startedAt.getTime())}</span>
          </Field>
        )}
      </dl>

      <div className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5F5F5B]">Linked commit</p>
        {task.commit ? (
          <p className="mt-3 flex items-center gap-3 text-sm">
            <span aria-hidden="true" className="size-2 rounded-full bg-[#191919]" />
            <span className="min-w-0 flex-1 truncate">{task.commit.message}</span>
            <span className="font-mono text-xs tabular-nums">+{task.commit.executionValue}</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-[#5F5F5B]">A commit is recorded when this task reaches Done.</p>
        )}
      </div>
    </div>
  );
}

const SOURCE: Record<string, string> = {
  task_completion: "Task completion",
  manual: "Manual commit",
  imported: "Imported",
  integration: "Integration",
};

export function CommitDetail({ commit, tz }: { commit: Commit; tz: string }) {
  return (
    <div>
      <p className="flex items-center gap-3">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-[#191919]" />
        <span className="font-mono text-xs tabular-nums text-[#5F5F5B]">{formatDateTime(commit.createdAt, tz)}</span>
      </p>
      <h2 className="mt-3 text-xl font-semibold leading-snug tracking-[-0.01em] text-[#171717]">{commit.message}</h2>
      <div className="neu-inverse mt-5 flex items-baseline justify-between rounded-[20px] px-5 py-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A9A9A6]">Execution</span>
        <span className="text-3xl font-semibold tabular-nums">+{commit.executionValue}</span>
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
        <Field label="Project">{commit.projectName ?? "None"}</Field>
        <Field label="Source">{SOURCE[commit.source] ?? commit.source}</Field>
        {commit.taskTitle && <Field label="Task">{commit.taskTitle}</Field>}
        {commit.taskCreatedAt && <Field label="Task created">{formatDateTime(commit.taskCreatedAt, tz)}</Field>}
        {commit.taskStartedAt && <Field label="Task started">{formatDateTime(commit.taskStartedAt, tz)}</Field>}
        {commit.taskStartedAt && commit.taskCompletedAt && (
          <Field label="Active duration">
            <span className="tabular-nums">{formatDuration(commit.taskCompletedAt.getTime() - commit.taskStartedAt.getTime())}</span>
          </Field>
        )}
      </dl>
      <p className="mt-6 text-xs leading-relaxed text-[#5F5F5B]">
        Commit time and execution value are permanent. Message, project and tags can be corrected.
      </p>
    </div>
  );
}

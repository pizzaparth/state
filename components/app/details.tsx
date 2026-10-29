import * as React from "react";
import type { getCommitDetail, getTaskDetail } from "@/db/queries";
import { dueState, formatDateTime, formatDuration } from "@/lib/format";
import { weightLabel } from "@/lib/weights";
import { Chip, DueLabel, PriorityMark } from "./primitives";
import { TaskPriority, TaskWeight } from "./task-fields";
import { TaskTitle } from "./task-title";

type Task = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;
type Commit = NonNullable<Awaited<ReturnType<typeof getCommitDetail>>>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 border-t border-white/[0.08] py-2.5 text-base">
      <dt className="text-[#9A9A96]">{label}</dt>
      <dd className="min-w-0 break-words text-[#F2F2EF]">{children}</dd>
    </div>
  );
}

export function TaskDetail({ task, tz, now, editable = false }: { task: Task; tz: string; now: Date; editable?: boolean }) {
  const state = task.completedAt ? "Done" : (task.columnName ?? "Inbox");
  return (
    <div>
      <TaskTitle taskId={task.id} title={task.title} editable={editable} />
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <Chip>{state}</Chip>
        {task.tags.map((t) => (
          <Chip key={t}>{t}</Chip>
        ))}
      </p>
      {task.description && <p className="app-field mt-5 rounded-[16px] p-4 text-base leading-relaxed text-[#D4D4D0]">{task.description}</p>}

      <dl className="mt-6">
        <Field label="Project">{task.projectName ?? "None"}</Field>
        <Field label="Board">{task.boardName ?? "Inbox"}</Field>
        <Field label="Assignee">{task.assigneeName ?? "Unassigned"}</Field>
        <Field label="Creator">{task.creatorName}</Field>
        <Field label="Priority">
          {editable ? (
            <TaskPriority taskId={task.id} priority={task.priority} />
          ) : task.priority === "none" ? (
            "None"
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
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#9A9A96]">Linked commit</p>
        {task.commit ? (
          <p className="mt-3 flex items-center gap-3 text-base">
            <span aria-hidden="true" className="size-2 rounded-full bg-[#F2F2EF]" />
            <span className="min-w-0 flex-1 truncate">{task.commit.message}</span>
            <span className="font-mono text-sm tabular-nums">+{task.commit.executionValue}</span>
          </p>
        ) : (
          <p className="mt-2 text-base text-[#9A9A96]">A commit is recorded when this task reaches Done.</p>
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
        <span aria-hidden="true" className="size-2.5 rounded-full bg-[#F2F2EF]" />
        <span className="font-mono text-sm tabular-nums text-[#9A9A96]">{formatDateTime(commit.createdAt, tz)}</span>
      </p>
      <h2 className="mt-3 text-xl font-semibold leading-snug tracking-[-0.01em] text-[#F2F2EF]">{commit.message}</h2>
      <div className="app-inverse mt-5 flex items-baseline justify-between rounded-[20px] px-5 py-4">
        <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#55554F]">Execution</span>
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
      <p className="mt-6 text-sm leading-relaxed text-[#9A9A96]">
        Commit time and execution value are permanent. Message, project and tags can be corrected.
      </p>
    </div>
  );
}

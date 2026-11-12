import * as React from "react";
import { ArrowUpRight, CalendarDays, Folder, Lock, Repeat, SignalHigh, Weight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { getCommitDetail, getTaskDetail } from "@/db/queries";
import { dayKey, dueState, formatDateTime, formatDuration } from "@/lib/format";
import { weightLabel } from "@/lib/weights";
import { cn } from "@/lib/utils";
import { Chip, DISPLAY, DueLabel, PriorityMark, TICK } from "./primitives";
import { TaskDue, TaskPriority, TaskProject, TaskRecurrence, TaskStatus, TaskWeight } from "./task-fields";
import { recurrenceLabel } from "@/lib/recurrence";
import { TaskTitle } from "./task-title";
import { CommitEditor } from "./commit-editor";
import { PanelLink } from "./detail-drawer";

type Task = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;
type Commit = NonNullable<Awaited<ReturnType<typeof getCommitDetail>>>;

// ------------------------------------------------------------------ building blocks

export function PanelSection({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className={cn(TICK, "text-[11px] text-[#71717A]")}>{title}</h3>
        {aside && <span className="font-mono text-[12px] tabular-nums text-[#71717A]">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** One property: icon and label on the left, value (or its inline editor) on the right. */
function Prop({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="-mx-2 grid grid-cols-[8.5rem_minmax(0,1fr)] items-start gap-3 rounded-[12px] px-2 py-1 transition-colors duration-150 hover:bg-[#FAFAFA]">
      <dt className="flex min-h-9 items-center gap-2 text-sm text-[#52525B]">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-[#71717A]" />
        {label}
      </dt>
      <dd className="flex min-h-9 min-w-0 flex-col justify-center break-words text-[15px] font-medium text-[#0A0A0A]">{children}</dd>
    </div>
  );
}

const None = () => <span className="font-normal text-[#71717A]">—</span>;

/** Three numbers across the top: the first is the object's value, in the accent. */
function Stats({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="app-panel grid grid-cols-3 divide-x divide-black/[0.06] rounded-[20px]">
      {items.map((s, i) => (
        <div key={s.label} className="min-w-0 px-4 py-3.5">
          <dt className={cn(TICK, "truncate text-[11px] text-[#71717A]")}>{s.label}</dt>
          <dd className={cn(DISPLAY, "mt-1.5 truncate tabular-nums leading-none", i === 0 ? "text-[2.25rem] text-[#D92B74]" : "pt-1.5 text-xl text-[#0A0A0A]")}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Created → started → done as a rail; reached steps are filled, the last one in the accent. */
function Timeline({ steps, tz }: { steps: { label: string; at: Date | null; final?: boolean }[]; tz: string }) {
  return (
    <ol className="relative ml-[5px] border-l border-black/[0.08]">
      {steps.map((s) => (
        <li key={s.label} className="relative flex min-h-9 items-baseline justify-between gap-3 py-1.5 pl-5">
          <span
            aria-hidden="true"
            className={cn(
              "absolute -left-[5.5px] top-[13px] size-2.5 rounded-full",
              !s.at ? "border border-black/20 bg-white" : s.final ? "bg-accent" : "bg-[#0A0A0A]"
            )}
          />
          <span className={cn("text-[15px] font-medium", s.at ? "text-[#0A0A0A]" : "text-[#71717A]")}>{s.label}</span>
          <span className="font-mono text-[13px] tabular-nums text-[#71717A]">{s.at ? formatDateTime(s.at, tz) : "not yet"}</span>
        </li>
      ))}
    </ol>
  );
}

/** Where a task stands, with a glyph so the state never rests on colour or words alone. */
function StatusPill({ state, done, started }: { state: string; done: boolean; started: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pl-2 pr-3 text-[13px] font-semibold",
        done ? "bg-accent text-white" : "border border-black/[0.10] bg-white text-[#0A0A0A]"
      )}
    >
      <svg viewBox="0 0 14 14" aria-hidden="true" className="size-3.5 shrink-0">
        {done ? (
          <>
            <circle cx="7" cy="7" r="6" fill="currentColor" opacity="0.25" />
            <path d="M4.2 7.2l1.9 1.9 3.7-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : started ? (
          <>
            <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 3.5a3.5 3.5 0 010 7z" fill="currentColor" />
          </>
        ) : (
          <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.2 2" />
        )}
      </svg>
      <span className="truncate">{state}</span>
    </span>
  );
}

const linkCard =
  "mi-row group flex min-h-14 items-center gap-3 rounded-[16px] border border-black/[0.10] bg-white px-4 py-3 transition-colors duration-150 hover:border-black/[0.18] hover:bg-[#FAFAFA]";

// ------------------------------------------------------------------ task

/** `projects` (the task's workspace) is passed only when the viewer may edit this task. */
export function TaskDetail({
  task,
  tz,
  now,
  editable = false,
  projects,
  statusColumns,
}: {
  task: Task;
  tz: string;
  now: Date;
  editable?: boolean;
  projects?: { id: string; name: string }[];
  /** The board's columns, for a board task the viewer may move. */
  statusColumns?: { id: string; name: string; stateType: string }[];
}) {
  const done = Boolean(task.completedAt);
  const state = done ? "Done" : (task.columnName ?? "Inbox");
  const cycle = task.startedAt && task.completedAt ? formatDuration(task.completedAt.getTime() - task.startedAt.getTime()) : null;
  const open = editable && !done;

  return (
    <div className="app-stagger space-y-8">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {editable && statusColumns && statusColumns.length > 0 ? (
            <TaskStatus taskId={task.id} columnId={task.columnId} columns={statusColumns} />
          ) : (
            <StatusPill state={state} done={done} started={Boolean(task.startedAt)} />
          )}
          {task.tags.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
        <TaskTitle taskId={task.id} title={task.title} editable={editable} />
        {task.description && <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#52525B]">{task.description}</p>}
      </div>

      <Stats
        items={[
          { label: done ? "Earned" : "On done", value: `+${task.weight}` },
          { label: "Cycle", value: cycle ?? <None /> },
          { label: "Due", value: task.dueAt ? <DueLabel due={dueState(task.dueAt, now, tz)} /> : <None /> },
        ]}
      />

      <PanelSection title="Properties">
        <dl>
          <Prop icon={Folder} label="Project">
            {editable && projects ? (
              <TaskProject taskId={task.id} projectId={task.projectId} projectName={task.projectName} projects={projects} />
            ) : (
              (task.projectName ?? <None />)
            )}
          </Prop>
          <Prop icon={SignalHigh} label="Priority">
            {editable ? <TaskPriority taskId={task.id} priority={task.priority} /> : task.priority === "none" ? <None /> : <PriorityMark priority={task.priority} />}
          </Prop>
          <Prop icon={Weight} label="Weight">
            {open ? (
              <TaskWeight taskId={task.id} weight={task.weight} />
            ) : (
              <span>
                {weightLabel(task.weight)} <span className="font-mono text-sm tabular-nums text-[#71717A]">+{task.weight}</span>
              </span>
            )}
          </Prop>
          <Prop icon={CalendarDays} label="Due">
            {open ? <TaskDue taskId={task.id} due={task.dueAt ? dayKey(task.dueAt, tz) : null} /> : task.dueAt ? <DueLabel due={dueState(task.dueAt, now, tz)} /> : <None />}
          </Prop>
          <Prop icon={Repeat} label="Repeats">
            {open ? <TaskRecurrence taskId={task.id} rule={task.recurrenceRule} /> : task.recurrenceRule ? recurrenceLabel(task.recurrenceRule) : <None />}
          </Prop>
        </dl>
      </PanelSection>

      <PanelSection title="Timeline" aside={cycle ? `cycle ${cycle}` : undefined}>
        <Timeline
          tz={tz}
          steps={[
            { label: "Created", at: task.createdAt },
            { label: "Started", at: task.startedAt },
            { label: "Done", at: task.completedAt, final: true },
          ]}
        />
      </PanelSection>

      <PanelSection title="Commit">
        {task.commit ? (
          <PanelLink from="task" to="commit" id={task.commit.id} className={linkCard}>
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-[#0A0A0A]">{task.commit.message}</span>
              <span className="block font-mono text-[12px] tabular-nums text-[#71717A]">{formatDateTime(task.commit.createdAt, tz)}</span>
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-accent">+{task.commit.executionValue}</span>
            <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-[#71717A] group-hover:text-[#0A0A0A]" />
            <span className="sr-only">Open commit</span>
          </PanelLink>
        ) : (
          <p className="rounded-[16px] border border-dashed border-black/[0.14] px-4 py-3.5 font-mono text-[13px] text-[#71717A]">auto-logged on Done · +{task.weight}</p>
        )}
      </PanelSection>
    </div>
  );
}

// ------------------------------------------------------------------ commit

const SOURCE: Record<string, string> = {
  task_completion: "Task done",
  manual: "Manual",
  imported: "Imported",
  integration: "Integration",
};

/** `projects` (the commit's workspace) is passed only when the viewer may correct this commit. */
export function CommitDetail({ commit, tz, projects }: { commit: Commit; tz: string; projects?: { id: string; name: string }[] }) {
  const cycle =
    commit.taskStartedAt && commit.taskCompletedAt ? formatDuration(commit.taskCompletedAt.getTime() - commit.taskStartedAt.getTime()) : null;
  const source = SOURCE[commit.source] ?? commit.source;

  return (
    <div className="app-stagger space-y-8">
      <div>
        <p className="mb-3 font-mono text-[13px] tabular-nums text-[#71717A]">{formatDateTime(commit.createdAt, tz)}</p>
        <h2 className={cn(DISPLAY, "break-words text-[1.75rem] leading-[1.08] text-[#0A0A0A]")}>{commit.message}</h2>
        {commit.tags.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-2">
            {commit.tags.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </p>
        )}
      </div>

      <Stats
        items={[
          { label: "Execution", value: `+${commit.executionValue}` },
          { label: "Cycle", value: cycle ?? <None /> },
          { label: "Source", value: source },
        ]}
      />

      <PanelSection title="Properties">
        <dl>
          <Prop icon={Folder} label="Project">
            {commit.projectName ?? <None />}
          </Prop>
        </dl>
      </PanelSection>

      {commit.taskId && commit.taskTitle && (
        <PanelSection title="Task">
          <PanelLink from="commit" to="task" id={commit.taskId} className={linkCard}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-[#0A0A0A]">{commit.taskTitle}</span>
              {commit.taskDescription && <span className="block truncate text-[13px] text-[#71717A]">{commit.taskDescription}</span>}
            </span>
            <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-[#71717A] group-hover:text-[#0A0A0A]" />
            <span className="sr-only">Open task</span>
          </PanelLink>
        </PanelSection>
      )}

      {commit.taskCreatedAt && (
        <PanelSection title="Timeline" aside={cycle ? `cycle ${cycle}` : undefined}>
          <Timeline
            tz={tz}
            steps={[
              { label: "Created", at: commit.taskCreatedAt },
              { label: "Started", at: commit.taskStartedAt },
              { label: "Committed", at: commit.createdAt, final: true },
            ]}
          />
        </PanelSection>
      )}

      <div>
        <p className="flex items-center gap-2 font-mono text-[12px] text-[#71717A]">
          <Lock aria-hidden="true" className="size-3.5" />
          time + value locked · message, project, tags fixable
        </p>
        {projects && <CommitEditor commit={commit} projects={projects} />}
      </div>
    </div>
  );
}

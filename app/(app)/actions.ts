"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { loadActor, MutationError, type Actor } from "@/lib/authz";
import { addBoardTask, finishOnboarding, createObjective, setObjectiveArchived, setObjectiveProgress, editCommit, setTaskRecurrence, captureTask, createManualCommit, createProject, setProjectArchived, updateProject, deleteTask, moveTask, placeTask, renameTask, restoreTask, setTaskDue, setTaskPriority, setTaskProject, setTaskWeight, setTimezone, completeTask, addColumn, bulkRestoreTasks, bulkUpdateTasks, deleteColumn, moveColumn, renameColumn, setColumnLimit } from "@/lib/mutations";
import { consumeThrottle } from "@/lib/security/throttle";
import { addBoardTaskSchema, finishOnboardingSchema, createObjectiveSchema, setObjectiveArchivedSchema, setObjectiveProgressSchema, editCommitSchema, setTaskRecurrenceSchema, captureTaskSchema, createProjectSchema, manualCommitSchema, setProjectArchivedSchema, updateProjectSchema, moveTaskSchema, placeTaskSchema, renameTaskSchema, setTaskDueSchema, setTaskPrioritySchema, setTaskProjectSchema, setTaskWeightSchema, setTimezoneSchema, taskRefSchema, addColumnSchema, bulkRestoreSchema, bulkUpdateSchema, columnRefSchema, moveColumnSchema, renameColumnSchema, setColumnLimitSchema } from "@/lib/validation";

/**
 * Server Actions for the product. Each one re-verifies everything itself: Server Actions
 * are public POST endpoints, and the (app) layout's session check does not
 * run for them. Next.js rejects cross-site calls by comparing Origin with Host.
 */

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// Per-user write budget, shared across instances (Postgres-backed)
const WRITES_PER_MINUTE = 60;

async function run<S extends z.ZodType, T>(schema: S, input: unknown, fn: (actor: Actor, data: z.infer<S>) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const session = await getSession();
    if (!session) throw new MutationError("unauthenticated", "Your session has ended. Sign in again.");
    if (!(await consumeThrottle(`write:${session.user.id}`, WRITES_PER_MINUTE, 60))) {
      throw new MutationError("rate_limited", "Too many changes at once. Wait a minute and try again.");
    }
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new MutationError("invalid", parsed.error.issues[0]?.message ?? "Check the form and try again.");
    const data = await fn(await loadActor(session.user.id), parsed.data);
    // Writes change Today, boards, metrics and the inbox count in the shell
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof MutationError) return { ok: false, error: error.message };
    console.error("[action]", error);
    return { ok: false, error: "Something went wrong. Your change was not saved." };
  }
}

export async function moveTaskAction(input: unknown) {
  return run(moveTaskSchema, input, moveTask);
}

export async function placeTaskAction(input: unknown) {
  return run(placeTaskSchema, input, placeTask);
}

export async function renameTaskAction(input: unknown) {
  return run(renameTaskSchema, input, renameTask);
}

export async function setTaskPriorityAction(input: unknown) {
  return run(setTaskPrioritySchema, input, setTaskPriority);
}

export async function setTaskProjectAction(input: unknown) {
  return run(setTaskProjectSchema, input, setTaskProject);
}

export async function setTaskWeightAction(input: unknown) {
  return run(setTaskWeightSchema, input, setTaskWeight);
}

export async function setTaskDueAction(input: unknown) {
  return run(setTaskDueSchema, input, setTaskDue);
}

export async function setTaskRecurrenceAction(input: unknown) {
  return run(setTaskRecurrenceSchema, input, setTaskRecurrence);
}

export async function deleteTaskAction(input: unknown) {
  return run(taskRefSchema, input, deleteTask);
}

export async function restoreTaskAction(input: unknown) {
  return run(taskRefSchema, input, restoreTask);
}

export async function captureTaskAction(input: unknown) {
  return run(captureTaskSchema, input, captureTask);
}

export async function createProjectAction(input: unknown) {
  return run(createProjectSchema, input, createProject);
}

export async function updateProjectAction(input: unknown) {
  return run(updateProjectSchema, input, updateProject);
}

export async function setProjectArchivedAction(input: unknown) {
  return run(setProjectArchivedSchema, input, setProjectArchived);
}

export async function addBoardTaskAction(input: unknown) {
  return run(addBoardTaskSchema, input, addBoardTask);
}

export async function finishOnboardingAction(input: unknown) {
  return run(finishOnboardingSchema, input, (actor) => finishOnboarding(actor));
}

export async function createObjectiveAction(input: unknown) {
  return run(createObjectiveSchema, input, createObjective);
}

export async function setObjectiveProgressAction(input: unknown) {
  return run(setObjectiveProgressSchema, input, setObjectiveProgress);
}

export async function setObjectiveArchivedAction(input: unknown) {
  return run(setObjectiveArchivedSchema, input, setObjectiveArchived);
}

export async function editCommitAction(input: unknown) {
  return run(editCommitSchema, input, editCommit);
}

export async function createCommitAction(input: unknown) {
  return run(manualCommitSchema, input, createManualCommit);
}

export async function setTimezoneAction(input: unknown) {
  return run(setTimezoneSchema, input, setTimezone);
}

export async function completeTaskAction(input: unknown) {
  return run(taskRefSchema, input, completeTask);
}

export async function renameColumnAction(input: unknown) {
  return run(renameColumnSchema, input, renameColumn);
}

export async function setColumnLimitAction(input: unknown) {
  return run(setColumnLimitSchema, input, setColumnLimit);
}

export async function addColumnAction(input: unknown) {
  return run(addColumnSchema, input, addColumn);
}

export async function moveColumnAction(input: unknown) {
  return run(moveColumnSchema, input, moveColumn);
}

export async function deleteColumnAction(input: unknown) {
  return run(columnRefSchema, input, deleteColumn);
}

export async function bulkUpdateTasksAction(input: unknown) {
  return run(bulkUpdateSchema, input, bulkUpdateTasks);
}

export async function bulkRestoreTasksAction(input: unknown) {
  return run(bulkRestoreSchema, input, bulkRestoreTasks);
}

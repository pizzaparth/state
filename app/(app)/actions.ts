"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { loadActor, MutationError } from "@/lib/authz";
import { consumeThrottle } from "@/lib/security/throttle";
import type { z } from "zod";
import { ACTIONS, type ActionData, type ActionDef, type ActionName } from "@/lib/actions/table";

/**
 * Server Actions for the product. Each one re-verifies everything itself: Server Actions
 * are public POST endpoints, and the (app) layout's session check does not
 * run for them. Next.js rejects cross-site calls by comparing Origin with Host.
 * Schemas and mutations live in lib/actions/table.ts, shared with the demo.
 */

export type ActionErrorCode = MutationError["code"] | "server" | "network";
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; code?: ActionErrorCode };

// Per-user write budget, shared across instances (Postgres-backed)
const WRITES_PER_MINUTE = 60;

async function run<N extends ActionName>(name: N, input: unknown): Promise<ActionResult<ActionData<N>>> {
  const { schema, fn } = ACTIONS[name] as unknown as ActionDef<z.ZodType, ActionData<N>>;
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
    if (error instanceof MutationError) return { ok: false, error: error.message, code: error.code };
    console.error("[action]", error);
    return { ok: false, error: "Something went wrong. Your change was not saved.", code: "server" };
  }
}

export async function moveTaskAction(input: unknown) {
  return run("moveTask", input);
}

export async function placeTaskAction(input: unknown) {
  return run("placeTask", input);
}

export async function renameTaskAction(input: unknown) {
  return run("renameTask", input);
}

export async function setTaskPriorityAction(input: unknown) {
  return run("setTaskPriority", input);
}

export async function setTaskProjectAction(input: unknown) {
  return run("setTaskProject", input);
}

export async function setTaskWeightAction(input: unknown) {
  return run("setTaskWeight", input);
}

export async function setTaskDueAction(input: unknown) {
  return run("setTaskDue", input);
}

export async function setTaskRecurrenceAction(input: unknown) {
  return run("setTaskRecurrence", input);
}

export async function deleteTaskAction(input: unknown) {
  return run("deleteTask", input);
}

export async function restoreTaskAction(input: unknown) {
  return run("restoreTask", input);
}

export async function captureTaskAction(input: unknown) {
  return run("captureTask", input);
}

export async function createProjectAction(input: unknown) {
  return run("createProject", input);
}

export async function updateProjectAction(input: unknown) {
  return run("updateProject", input);
}

export async function setProjectArchivedAction(input: unknown) {
  return run("setProjectArchived", input);
}

export async function addBoardTaskAction(input: unknown) {
  return run("addBoardTask", input);
}

export async function finishOnboardingAction(input: unknown) {
  return run("finishOnboarding", input);
}

export async function createObjectiveAction(input: unknown) {
  return run("createObjective", input);
}

export async function setObjectiveProgressAction(input: unknown) {
  return run("setObjectiveProgress", input);
}

export async function setObjectiveArchivedAction(input: unknown) {
  return run("setObjectiveArchived", input);
}

export async function editCommitAction(input: unknown) {
  return run("editCommit", input);
}

export async function createCommitAction(input: unknown) {
  return run("createCommit", input);
}

export async function setTimezoneAction(input: unknown) {
  return run("setTimezone", input);
}

export async function completeTaskAction(input: unknown) {
  return run("completeTask", input);
}

export async function renameColumnAction(input: unknown) {
  return run("renameColumn", input);
}

export async function setColumnLimitAction(input: unknown) {
  return run("setColumnLimit", input);
}

export async function addColumnAction(input: unknown) {
  return run("addColumn", input);
}

export async function moveColumnAction(input: unknown) {
  return run("moveColumn", input);
}

export async function deleteColumnAction(input: unknown) {
  return run("deleteColumn", input);
}

export async function bulkUpdateTasksAction(input: unknown) {
  return run("bulkUpdateTasks", input);
}

export async function bulkRestoreTasksAction(input: unknown) {
  return run("bulkRestoreTasks", input);
}

export async function captureManyAction(input: unknown) {
  return run("captureMany", input);
}

export async function setTaskTagsAction(input: unknown) {
  return run("setTaskTags", input);
}

export async function withdrawCommitAction(input: unknown) {
  return run("withdrawCommit", input);
}

export async function restoreCommitAction(input: unknown) {
  return run("restoreCommit", input);
}

export async function updateObjectiveAction(input: unknown) {
  return run("updateObjective", input);
}

export async function setTaskDescriptionAction(input: unknown) {
  return run("setTaskDescription", input);
}

export async function setTaskDeferAction(input: unknown) {
  return run("setTaskDefer", input);
}

export async function setTaskPlannedAction(input: unknown) {
  return run("setTaskPlanned", input);
}

export async function setTaskStageAction(input: unknown) {
  return run("setTaskStage", input);
}

export async function skipRecurrenceAction(input: unknown) {
  return run("skipRecurrence", input);
}

export async function duplicateTaskAction(input: unknown) {
  return run("duplicateTask", input);
}

export async function renameTagAction(input: unknown) {
  return run("renameTag", input);
}

export async function mergeTagsAction(input: unknown) {
  return run("mergeTags", input);
}

export async function deleteTagAction(input: unknown) {
  return run("deleteTag", input);
}

export async function setProjectNotesAction(input: unknown) {
  return run("setProjectNotes", input);
}

export async function setPreferencesAction(input: unknown) {
  return run("setPreferences", input);
}

"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { hasPaidAccess } from "@/lib/billing/access";
import { loadActor, MutationError, type Actor } from "@/lib/authz";
import { captureTask, createManualCommit, createProject, setProjectArchived, updateProject, deleteTask, moveTask, placeTask, renameTask, restoreTask, setTaskPriority, setTaskWeight } from "@/lib/mutations";
import { consumeThrottle } from "@/lib/security/throttle";
import { captureTaskSchema, createProjectSchema, manualCommitSchema, setProjectArchivedSchema, updateProjectSchema, moveTaskSchema, placeTaskSchema, renameTaskSchema, setTaskPrioritySchema, setTaskWeightSchema, taskRefSchema } from "@/lib/validation";

/**
 * Server Actions for the product. Each one re-verifies everything itself: Server Actions
 * are public POST endpoints, and the (app) layout's session and paywall checks do not
 * run for them. Next.js rejects cross-site calls by comparing Origin with Host.
 */

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// Per-user write budget, shared across instances (Postgres-backed)
const WRITES_PER_MINUTE = 60;

async function run<S extends z.ZodType, T>(schema: S, input: unknown, fn: (actor: Actor, data: z.infer<S>) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const session = await getSession();
    if (!session) throw new MutationError("unauthenticated", "Your session has ended. Sign in again.");
    if (!(await hasPaidAccess(session.user.id))) throw new MutationError("forbidden", "Your subscription is not active.");
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

export async function setTaskWeightAction(input: unknown) {
  return run(setTaskWeightSchema, input, setTaskWeight);
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

export async function createCommitAction(input: unknown) {
  return run(manualCommitSchema, input, createManualCommit);
}

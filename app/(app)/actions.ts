"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { hasPaidAccess } from "@/lib/billing/access";
import { loadActor, MutationError, type Actor } from "@/lib/authz";
import { deleteAccount, IdentityError, verifyIdentity } from "@/lib/accounts/delete";
import { setAutoRenew } from "@/lib/billing/manage";
import { editCommit, acceptInvitation, setTaskRecurrence, captureTask, createManualCommit, createOrganisation, createProject, inviteMember, leaveOrganisation, removeMember, revokeInvitation, setMemberRole, setProjectArchived, updateProject, deleteTask, moveTask, placeTask, renameTask, restoreTask, setTaskDue, setTaskPriority, setTaskWeight } from "@/lib/mutations";
import { consumeThrottle } from "@/lib/security/throttle";
import { editCommitSchema, acceptInvitationSchema, setTaskRecurrenceSchema, captureTaskSchema, createOrganisationSchema, createProjectSchema, invitationRefSchema, inviteMemberSchema, memberRefSchema, organisationRefSchema, setMemberRoleSchema, deleteAccountSchema, setAutoRenewSchema, manualCommitSchema, setProjectArchivedSchema, updateProjectSchema, moveTaskSchema, placeTaskSchema, renameTaskSchema, setTaskDueSchema, setTaskPrioritySchema, setTaskWeightSchema, taskRefSchema } from "@/lib/validation";

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

export async function createOrganisationAction(input: unknown) {
  return run(createOrganisationSchema, input, createOrganisation);
}

export async function inviteMemberAction(input: unknown) {
  return run(inviteMemberSchema, input, async (actor, data) => {
    // Each invitation sends an email: cap them per sender and per address
    if (!(await consumeThrottle(`invite:${actor.id}`, 30, 60 * 60)) || !(await consumeThrottle(`invite-to:${data.email}`, 3, 60 * 60))) {
      throw new MutationError("rate_limited", "Too many invitations. Try again in an hour.");
    }
    return inviteMember(actor, data);
  });
}

export async function revokeInvitationAction(input: unknown) {
  return run(invitationRefSchema, input, revokeInvitation);
}

export async function setMemberRoleAction(input: unknown) {
  return run(setMemberRoleSchema, input, setMemberRole);
}

export async function removeMemberAction(input: unknown) {
  return run(memberRefSchema, input, removeMember);
}

export async function leaveOrganisationAction(input: unknown) {
  return run(organisationRefSchema, input, leaveOrganisation);
}

/**
 * Accepts an organisation invitation. Needs a signed-in account whose verified email is
 * the invited address, but not a subscription: joining comes before paying. Not run
 * through run(), which requires paid access.
 */
export async function acceptInvitationAction(input: unknown): Promise<ActionResult<{ slug: string }>> {
  try {
    const session = await getSession();
    if (!session) throw new MutationError("unauthenticated", "Your session has ended. Sign in again.");
    if (!(await consumeThrottle(`accept-invite:${session.user.id}`, 10, 15 * 60))) {
      throw new MutationError("rate_limited", "Too many attempts. Try again in 15 minutes.");
    }
    const parsed = acceptInvitationSchema.safeParse(input);
    if (!parsed.success) throw new MutationError("invalid", parsed.error.issues[0]?.message ?? "This invitation link is not valid.");
    const data = await acceptInvitation(session.user, parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof MutationError) return { ok: false, error: error.message };
    console.error("[action] accept invitation", error);
    return { ok: false, error: "Something went wrong. You have not joined yet." };
  }
}

export async function editCommitAction(input: unknown) {
  return run(editCommitSchema, input, editCommit);
}

export async function createCommitAction(input: unknown) {
  return run(manualCommitSchema, input, createManualCommit);
}

export async function setAutoRenewAction(input: unknown) {
  return run(setAutoRenewSchema, input, async (actor, { renew }) => {
    // Each change calls the payment provider; cap them per account
    if (!(await consumeThrottle(`billing:${actor.id}`, 10, 60 * 60))) {
      throw new MutationError("rate_limited", "Too many billing changes. Try again in an hour.");
    }
    return setAutoRenew(actor.id, renew);
  });
}

export type DeleteAccountResult = { ok: true } | { ok: false; error: string; field?: "confirm" | "password" };

/**
 * Permanently deletes the signed-in account (lib/accounts/delete.ts). Works without an
 * active plan, so a lapsed subscriber can still close their account. Not run through
 * run(): that requires paid access and revalidates pages this account no longer has.
 */
export async function deleteAccountAction(input: unknown): Promise<DeleteAccountResult> {
  try {
    const session = await getSession();
    if (!session) throw new MutationError("unauthenticated", "Your session has ended. Sign in again.");
    // Password guesses are capped per account, not per IP
    if (!(await consumeThrottle(`delete-account:${session.user.id}`, 5, 15 * 60))) {
      throw new MutationError("rate_limited", "Too many attempts. Try again in 15 minutes.");
    }
    const parsed = deleteAccountSchema.safeParse(input);
    if (!parsed.success) throw new MutationError("invalid", "Check the form and try again.");
    if (parsed.data.confirm.toLowerCase() !== session.user.email.toLowerCase()) {
      return { ok: false, field: "confirm", error: "Type your email exactly as shown." };
    }
    await verifyIdentity(session.user.id, session.session.createdAt, parsed.data.password);
    await deleteAccount(session.user.id);

    // Sessions went with the account; drop the now-useless cookies too
    const jar = await cookies();
    for (const { name } of jar.getAll()) {
      if (name.includes("better-auth.")) jar.set(name, "", { maxAge: 0, path: "/", secure: name.startsWith("__Secure-") });
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof IdentityError) return { ok: false, error: error.message, field: error.field === "password" ? "password" : undefined };
    if (error instanceof MutationError) return { ok: false, error: error.message };
    console.error("[action] delete account", error);
    return { ok: false, error: "Something went wrong. Your account was not deleted." };
  }
}

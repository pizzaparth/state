import * as server from "./actions";
import type { ActionResult } from "./actions";
import { broadcastWrite, saveStore } from "@/lib/save-state";

export type { ActionResult, ActionErrorCode } from "./actions";

/**
 * Client entry to the product's Server Actions. Every component imports actions from
 * here, so one place handles what all writes share:
 *
 *   session ended   go to /login?next=<this page> (A22)
 *   network failure retry up to three times with backoff before giving up (C45);
 *                   writes that create something are not retried, to avoid duplicates
 *   saving state    the top bar's saving… / saved / offline label (C45)
 *   other tabs      told to refresh after a successful write (C43)
 */

const BACKOFF_MS = [800, 2000, 4500];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function guard<T>(action: (input: unknown) => Promise<ActionResult<T>>, retry = true): (input?: unknown) => Promise<ActionResult<T>> {
  return async (input?: unknown) => {
    saveStore.start();
    let result: ActionResult<T> | undefined;
    for (let attempt = 0; ; attempt++) {
      try {
        result = await action(input);
        break;
      } catch {
        // Thrown only when the request itself failed (offline, connection reset)
        if (!retry || attempt >= BACKOFF_MS.length) {
          result = { ok: false, error: "Could not reach the server. Your change was not saved.", code: "network" };
          break;
        }
        saveStore.wait();
        await wait(BACKOFF_MS[attempt]);
        saveStore.unwait();
      }
    }
    saveStore.finish(result.ok);
    if (result.ok) broadcastWrite();
    else if (result.code === "unauthenticated" && typeof window !== "undefined") {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
    return result;
  };
}

export const moveTaskAction = guard(server.moveTaskAction);
export const placeTaskAction = guard(server.placeTaskAction);
export const renameTaskAction = guard(server.renameTaskAction);
export const setTaskPriorityAction = guard(server.setTaskPriorityAction);
export const setTaskProjectAction = guard(server.setTaskProjectAction);
export const setTaskWeightAction = guard(server.setTaskWeightAction);
export const setTaskDueAction = guard(server.setTaskDueAction);
export const setTaskRecurrenceAction = guard(server.setTaskRecurrenceAction);
export const deleteTaskAction = guard(server.deleteTaskAction);
export const restoreTaskAction = guard(server.restoreTaskAction);
export const captureTaskAction = guard(server.captureTaskAction, false);
export const createProjectAction = guard(server.createProjectAction, false);
export const updateProjectAction = guard(server.updateProjectAction);
export const setProjectArchivedAction = guard(server.setProjectArchivedAction);
export const addBoardTaskAction = guard(server.addBoardTaskAction, false);
export const finishOnboardingAction = guard(server.finishOnboardingAction);
export const createObjectiveAction = guard(server.createObjectiveAction, false);
export const setObjectiveProgressAction = guard(server.setObjectiveProgressAction);
export const setObjectiveArchivedAction = guard(server.setObjectiveArchivedAction);
export const editCommitAction = guard(server.editCommitAction);
export const createCommitAction = guard(server.createCommitAction, false);
export const setTimezoneAction = guard(server.setTimezoneAction);
export const completeTaskAction = guard(server.completeTaskAction);
export const renameColumnAction = guard(server.renameColumnAction);
export const setColumnLimitAction = guard(server.setColumnLimitAction);
export const addColumnAction = guard(server.addColumnAction, false);
export const moveColumnAction = guard(server.moveColumnAction);
export const deleteColumnAction = guard(server.deleteColumnAction);
export const bulkUpdateTasksAction = guard(server.bulkUpdateTasksAction);
export const bulkRestoreTasksAction = guard(server.bulkRestoreTasksAction);
export const captureManyAction = guard(server.captureManyAction, false);
export const setTaskTagsAction = guard(server.setTaskTagsAction);
export const withdrawCommitAction = guard(server.withdrawCommitAction);
export const restoreCommitAction = guard(server.restoreCommitAction);
export const updateObjectiveAction = guard(server.updateObjectiveAction);

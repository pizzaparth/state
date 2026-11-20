import * as server from "./actions";
import type { ActionResult } from "./actions";
import { broadcastWrite, saveStore } from "@/lib/save-state";
import { demoRuntime } from "@/lib/demo/runtime";
import type { ActionName } from "@/lib/actions/table";

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
 *   demo            the same write runs on the demo's database in this browser
 *                   (lib/demo/actions.ts, loaded only in a demo)
 */

const BACKOFF_MS = [800, 2000, 4500];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function guard<T>(name: ActionName, action: (input: unknown) => Promise<ActionResult<T>>, retry = true): (input?: unknown) => Promise<ActionResult<T>> {
  return async (input?: unknown) => {
    saveStore.start();
    let result: ActionResult<T> | undefined;
    if (demoRuntime()) {
      const { runDemoAction } = await import("@/lib/demo/actions");
      result = (await runDemoAction(name, input)) as ActionResult<T>;
      saveStore.finish(result.ok);
      if (result.ok) broadcastWrite();
      return result;
    }
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

export const moveTaskAction = guard("moveTask", server.moveTaskAction);
export const placeTaskAction = guard("placeTask", server.placeTaskAction);
export const renameTaskAction = guard("renameTask", server.renameTaskAction);
export const setTaskPriorityAction = guard("setTaskPriority", server.setTaskPriorityAction);
export const setTaskProjectAction = guard("setTaskProject", server.setTaskProjectAction);
export const setTaskWeightAction = guard("setTaskWeight", server.setTaskWeightAction);
export const setTaskDueAction = guard("setTaskDue", server.setTaskDueAction);
export const setTaskRecurrenceAction = guard("setTaskRecurrence", server.setTaskRecurrenceAction);
export const deleteTaskAction = guard("deleteTask", server.deleteTaskAction);
export const restoreTaskAction = guard("restoreTask", server.restoreTaskAction);
export const captureTaskAction = guard("captureTask", server.captureTaskAction, false);
export const createProjectAction = guard("createProject", server.createProjectAction, false);
export const updateProjectAction = guard("updateProject", server.updateProjectAction);
export const setProjectArchivedAction = guard("setProjectArchived", server.setProjectArchivedAction);
export const addBoardTaskAction = guard("addBoardTask", server.addBoardTaskAction, false);
export const finishOnboardingAction = guard("finishOnboarding", server.finishOnboardingAction);
export const createObjectiveAction = guard("createObjective", server.createObjectiveAction, false);
export const setObjectiveProgressAction = guard("setObjectiveProgress", server.setObjectiveProgressAction);
export const setObjectiveArchivedAction = guard("setObjectiveArchived", server.setObjectiveArchivedAction);
export const editCommitAction = guard("editCommit", server.editCommitAction);
export const createCommitAction = guard("createCommit", server.createCommitAction, false);
export const setTimezoneAction = guard("setTimezone", server.setTimezoneAction);
export const completeTaskAction = guard("completeTask", server.completeTaskAction);
export const renameColumnAction = guard("renameColumn", server.renameColumnAction);
export const setColumnLimitAction = guard("setColumnLimit", server.setColumnLimitAction);
export const addColumnAction = guard("addColumn", server.addColumnAction, false);
export const moveColumnAction = guard("moveColumn", server.moveColumnAction);
export const deleteColumnAction = guard("deleteColumn", server.deleteColumnAction);
export const bulkUpdateTasksAction = guard("bulkUpdateTasks", server.bulkUpdateTasksAction);
export const bulkRestoreTasksAction = guard("bulkRestoreTasks", server.bulkRestoreTasksAction);
export const captureManyAction = guard("captureMany", server.captureManyAction, false);
export const setTaskTagsAction = guard("setTaskTags", server.setTaskTagsAction);
export const withdrawCommitAction = guard("withdrawCommit", server.withdrawCommitAction);
export const restoreCommitAction = guard("restoreCommit", server.restoreCommitAction);
export const updateObjectiveAction = guard("updateObjective", server.updateObjectiveAction);
export const setTaskDescriptionAction = guard("setTaskDescription", server.setTaskDescriptionAction);
export const setTaskDeferAction = guard("setTaskDefer", server.setTaskDeferAction);
export const setTaskPlannedAction = guard("setTaskPlanned", server.setTaskPlannedAction);
export const setTaskStageAction = guard("setTaskStage", server.setTaskStageAction);
export const skipRecurrenceAction = guard("skipRecurrence", server.skipRecurrenceAction);
export const duplicateTaskAction = guard("duplicateTask", server.duplicateTaskAction, false);
export const renameTagAction = guard("renameTag", server.renameTagAction);
export const mergeTagsAction = guard("mergeTags", server.mergeTagsAction);
export const deleteTagAction = guard("deleteTag", server.deleteTagAction);
export const setProjectNotesAction = guard("setProjectNotes", server.setProjectNotesAction);
export const setPreferencesAction = guard("setPreferences", server.setPreferencesAction);

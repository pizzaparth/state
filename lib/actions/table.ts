import type { z } from "zod";
import type { Actor } from "@/lib/authz";
import { addBoardTask, finishOnboarding, createObjective, setObjectiveArchived, setObjectiveProgress, editCommit, setTaskRecurrence, captureTask, createManualCommit, createProject, setProjectArchived, updateProject, deleteTask, moveTask, placeTask, renameTask, restoreTask, setTaskDue, setTaskPriority, setTaskProject, setTaskWeight, setTimezone, completeTask, addColumn, bulkRestoreTasks, bulkUpdateTasks, deleteColumn, moveColumn, renameColumn, setColumnLimit, captureMany, setTaskTags, restoreCommit, withdrawCommit, updateObjective, setTaskDescription, setTaskDefer, setTaskPlanned, setTaskStage, skipRecurrence, duplicateTask, renameTag, mergeTags, deleteTag, setProjectNotes, setPreferences } from "@/lib/mutations";
import { setPreferencesSchema } from "@/lib/preferences";
import { addBoardTaskSchema, finishOnboardingSchema, createObjectiveSchema, setObjectiveArchivedSchema, setObjectiveProgressSchema, editCommitSchema, setTaskRecurrenceSchema, captureTaskSchema, createProjectSchema, manualCommitSchema, setProjectArchivedSchema, updateProjectSchema, moveTaskSchema, placeTaskSchema, renameTaskSchema, setTaskDueSchema, setTaskPrioritySchema, setTaskProjectSchema, setTaskWeightSchema, setTimezoneSchema, taskRefSchema, addColumnSchema, bulkRestoreSchema, bulkUpdateSchema, columnRefSchema, moveColumnSchema, renameColumnSchema, setColumnLimitSchema, captureManySchema, setTaskTagsSchema, commitRefSchema, updateObjectiveSchema, mergeTagsSchema, renameTagSchema, setProjectNotesSchema, setTaskDeferSchema, setTaskDescriptionSchema, setTaskPlannedSchema, setTaskStageSchema, tagRefSchema } from "@/lib/validation";

/**
 * Every product write: its strict Zod schema and the mutation it runs. The owner's
 * Server Actions (app/(app)/actions.ts) and the demo's in-browser writes
 * (lib/demo/actions.ts) both go through this table, so validation and rules are the same.
 */

export interface ActionDef<S extends z.ZodType = z.ZodType, T = unknown> {
  schema: S;
  fn: (actor: Actor, data: z.infer<S>) => Promise<T>;
}

const action = <S extends z.ZodType, T>(schema: S, fn: (actor: Actor, data: z.infer<S>) => Promise<T>): ActionDef<S, T> => ({ schema, fn });

export const ACTIONS = {
  moveTask: action(moveTaskSchema, moveTask),
  placeTask: action(placeTaskSchema, placeTask),
  renameTask: action(renameTaskSchema, renameTask),
  setTaskPriority: action(setTaskPrioritySchema, setTaskPriority),
  setTaskProject: action(setTaskProjectSchema, setTaskProject),
  setTaskWeight: action(setTaskWeightSchema, setTaskWeight),
  setTaskDue: action(setTaskDueSchema, setTaskDue),
  setTaskRecurrence: action(setTaskRecurrenceSchema, setTaskRecurrence),
  deleteTask: action(taskRefSchema, deleteTask),
  restoreTask: action(taskRefSchema, restoreTask),
  captureTask: action(captureTaskSchema, captureTask),
  createProject: action(createProjectSchema, createProject),
  updateProject: action(updateProjectSchema, updateProject),
  setProjectArchived: action(setProjectArchivedSchema, setProjectArchived),
  addBoardTask: action(addBoardTaskSchema, addBoardTask),
  finishOnboarding: action(finishOnboardingSchema, (actor) => finishOnboarding(actor)),
  createObjective: action(createObjectiveSchema, createObjective),
  setObjectiveProgress: action(setObjectiveProgressSchema, setObjectiveProgress),
  setObjectiveArchived: action(setObjectiveArchivedSchema, setObjectiveArchived),
  editCommit: action(editCommitSchema, editCommit),
  createCommit: action(manualCommitSchema, createManualCommit),
  setTimezone: action(setTimezoneSchema, setTimezone),
  completeTask: action(taskRefSchema, completeTask),
  renameColumn: action(renameColumnSchema, renameColumn),
  setColumnLimit: action(setColumnLimitSchema, setColumnLimit),
  addColumn: action(addColumnSchema, addColumn),
  moveColumn: action(moveColumnSchema, moveColumn),
  deleteColumn: action(columnRefSchema, deleteColumn),
  bulkUpdateTasks: action(bulkUpdateSchema, bulkUpdateTasks),
  bulkRestoreTasks: action(bulkRestoreSchema, bulkRestoreTasks),
  captureMany: action(captureManySchema, captureMany),
  setTaskTags: action(setTaskTagsSchema, setTaskTags),
  withdrawCommit: action(commitRefSchema, withdrawCommit),
  restoreCommit: action(commitRefSchema, restoreCommit),
  updateObjective: action(updateObjectiveSchema, updateObjective),
  setTaskDescription: action(setTaskDescriptionSchema, setTaskDescription),
  setTaskDefer: action(setTaskDeferSchema, setTaskDefer),
  setTaskPlanned: action(setTaskPlannedSchema, setTaskPlanned),
  setTaskStage: action(setTaskStageSchema, setTaskStage),
  skipRecurrence: action(taskRefSchema, skipRecurrence),
  duplicateTask: action(taskRefSchema, duplicateTask),
  renameTag: action(renameTagSchema, renameTag),
  mergeTags: action(mergeTagsSchema, mergeTags),
  deleteTag: action(tagRefSchema, deleteTag),
  setProjectNotes: action(setProjectNotesSchema, setProjectNotes),
  setPreferences: action(setPreferencesSchema, setPreferences),
};

export type ActionName = keyof typeof ACTIONS;
export type ActionData<N extends ActionName> = Awaited<ReturnType<(typeof ACTIONS)[N]["fn"]>>;

import type { z } from "zod";
import type { ActionResult } from "@/app/(app)/actions";
import { ACTIONS, type ActionData, type ActionDef, type ActionName } from "@/lib/actions/table";
import { loadActor, MutationError } from "@/lib/authz";
import { bumpDemoData, demoRuntime } from "./runtime";
import { flushDemoDatabase } from "./db/client";

/**
 * A demo write: the same schema and mutation as the owner's Server Action
 * (lib/actions/table.ts), run on the demo's database in this browser. Identity comes from
 * the running demo, never from the input. Loaded only in a demo (client-actions.ts).
 */
export async function runDemoAction<N extends ActionName>(name: N, input: unknown): Promise<ActionResult<ActionData<N>>> {
  const { schema, fn } = ACTIONS[name] as unknown as ActionDef<z.ZodType, ActionData<N>>;
  try {
    const demo = demoRuntime();
    if (!demo) throw new MutationError("unauthenticated", "The demo has ended. Start a new one.");
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new MutationError("invalid", parsed.error.issues[0]?.message ?? "Check the form and try again.");
    const data = await fn(await loadActor(demo.userId), parsed.data);
    // Stored before it is reported saved, so a refresh right after keeps it
    await flushDemoDatabase();
    bumpDemoData();
    return { ok: true, data };
  } catch (error) {
    if (error instanceof MutationError) return { ok: false, error: error.message, code: error.code };
    console.error("[demo action]", error);
    return { ok: false, error: "Something went wrong. Your change was not saved.", code: "server" };
  }
}

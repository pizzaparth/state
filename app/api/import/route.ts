import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { hasPaidAccess } from "@/lib/billing/access";
import { loadActor, MutationError } from "@/lib/authz";
import { parseImport } from "@/lib/data/import";
import { importData } from "@/lib/mutations";
import { readTextBody, rejectCrossOrigin } from "@/lib/security/request";
import { consumeThrottle } from "@/lib/security/throttle";
import { IMPORT_LIMITS } from "@/lib/validation";

/**
 * Imports a State JSON export or a tasks / commits / projects CSV into the signed-in
 * person's personal workspace. The file is the raw request body.
 *
 * A Route Handler rather than a Server Action: files run to megabytes, and raising the
 * Server Action body limit (64 kB, next.config.ts) would raise it for every action. It
 * applies the same checks as app/(app)/actions.ts: session, paid access, a per-user
 * budget, strict validation (lib/validation importSchema) and assertWritable in
 * lib/mutations.ts importData.
 */
export async function POST(req: NextRequest) {
  const crossOrigin = rejectCrossOrigin(req);
  if (crossOrigin) return crossOrigin;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Your session has ended. Sign in again." }, { status: 401 });
  if (!(await hasPaidAccess(session.user.id))) return NextResponse.json({ error: "Your subscription is not active." }, { status: 403 });
  if (!(await consumeThrottle(`import:${session.user.id}`, 10, 60 * 60))) {
    return NextResponse.json({ error: "Too many imports. Try again in an hour." }, { status: 429 });
  }

  const body = await readTextBody(req, IMPORT_LIMITS.bytes);
  if (!body.ok) return NextResponse.json({ error: "Files can be up to 4 MB." }, { status: 413 });

  const parsed = parseImport(body.text);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const result = await importData(await loadActor(session.user.id), parsed.data);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, kind: parsed.kind, result });
  } catch (error) {
    if (error instanceof MutationError) return NextResponse.json({ error: error.message }, { status: error.code === "not_found" ? 404 : 400 });
    console.error("[import]", error);
    return NextResponse.json({ error: "Import failed. Nothing was saved." }, { status: 500 });
  }
}

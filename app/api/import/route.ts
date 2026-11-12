import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { loadActor, MutationError } from "@/lib/authz";
import { parseImport } from "@/lib/data/import";
import { importData } from "@/lib/mutations";
import { readTextBody, rejectCrossOrigin } from "@/lib/security/request";
import { consumeThrottle } from "@/lib/security/throttle";
import { IMPORT_LIMITS } from "@/lib/validation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Imports a State JSON export, a tasks / commits / projects CSV, or a plain .txt task
 * list (text/plain) into the signed-in person's personal workspace. The file is the raw
 * request body. With ?dry=1 nothing is written: the counts come back for a preview.
 *
 * A Route Handler rather than a Server Action: files run to megabytes, and raising the
 * Server Action body limit (64 kB, next.config.ts) would raise it for every action. It
 * applies the same checks as app/(app)/actions.ts: session, a per-user
 * budget, strict validation (lib/validation importSchema) and assertWritable in
 * lib/mutations.ts importData.
 */
export async function POST(req: NextRequest) {
  const crossOrigin = rejectCrossOrigin(req);
  if (crossOrigin) return crossOrigin;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Your session has ended. Sign in again." }, { status: 401 });
  // ?dry=1 validates and counts without writing (the form's preview step); previews have their own budget
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  if (!(await consumeThrottle(`${dry ? "import-dry" : "import"}:${session.user.id}`, dry ? 30 : 10, 60 * 60))) {
    return NextResponse.json({ error: "Too many imports. Try again in an hour." }, { status: 429 });
  }

  const body = await readTextBody(req, IMPORT_LIMITS.bytes);
  if (!body.ok) return NextResponse.json({ error: "Files can be up to 4 MB." }, { status: 413 });

  const format = req.headers.get("content-type")?.startsWith("text/plain") ? "txt" : undefined;
  const [user] = await db.select({ tz: users.timezone }).from(users).where(eq(users.id, session.user.id)).limit(1);
  const parsed = parseImport(body.text, { format, tz: user?.tz });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, errors: parsed.errors }, { status: 400 });

  try {
    const result = await importData(await loadActor(session.user.id), parsed.data, { dryRun: dry });
    if (!dry) revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, dry, kind: parsed.kind, result });
  } catch (error) {
    if (error instanceof MutationError) return NextResponse.json({ error: error.message }, { status: error.code === "not_found" ? 404 : 400 });
    console.error("[import]", error);
    return NextResponse.json({ error: "Import failed. Nothing was saved." }, { status: 500 });
  }
}

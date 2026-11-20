import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { buildExportFile } from "@/lib/data/export";
import { consumeThrottle } from "@/lib/security/throttle";

/**
 * Downloads the signed-in person's data. Needs a session: data
 * stays exportable after a subscription ends (docs/state_desc.md §40).
 *
 *   ?format=json                          everything (lib/data/export.ts)
 *   ?format=csv&dataset=tasks|commits|projects
 */
const querySchema = z.discriminatedUnion("format", [
  z.strictObject({ format: z.literal("json") }),
  z.strictObject({ format: z.literal("csv"), dataset: z.enum(["tasks", "commits", "projects"]) }),
]);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to export your data." }, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Choose format=json, or format=csv with dataset=tasks, commits or projects." }, { status: 400 });

  // Each export reads the whole workspace; cap them per account
  if (!(await consumeThrottle(`export:${session.user.id}`, 30, 60 * 60))) {
    return NextResponse.json({ error: "Too many exports. Try again in an hour." }, { status: 429 });
  }

  const { body, name, type } = await buildExportFile(session.user.id, parsed.data);

  return new NextResponse(body, {
    headers: {
      "content-type": type,
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}

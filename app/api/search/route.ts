import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchWork } from "@/db/queries";
import { getSession } from "@/lib/auth/session";
import { loadActor } from "@/lib/authz";
import { consumeThrottle } from "@/lib/security/throttle";

/**
 * Search for the command palette: tasks by title and commits by message in every
 * workspace the signed-in person can read. Same gates as product pages (session, and a
 * own personal workspace); results never leave it.
 *
 *   GET /api/search?q=parser
 */
const querySchema = z.strictObject({
  q: z.string().trim().min(2).max(100),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to search." }, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Search for 2 to 100 characters." }, { status: 400 });

  // The palette searches as you type; cap it per account
  if (!(await consumeThrottle(`search:${session.user.id}`, 120, 60))) {
    return NextResponse.json({ error: "Too many searches. Wait a moment." }, { status: 429 });
  }

  const actor = await loadActor(session.user.id);
  const hits = await searchWork(parsed.data.q, [...actor.readable]);
  return NextResponse.json({ hits }, { headers: { "cache-control": "private, no-store" } });
}

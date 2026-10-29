import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchWork } from "@/db/queries";
import { getSession } from "@/lib/auth/session";
import { loadActor } from "@/lib/authz";
import { getAccess } from "@/lib/billing/access";
import { consumeThrottle } from "@/lib/security/throttle";

/**
 * Search for the command palette: tasks by title and commits by message in every
 * workspace the signed-in person can read. Same gates as product pages (session, and a
 * plan that is current or read-only); results never leave those workspaces.
 *
 *   GET /api/search?q=parser
 */
const querySchema = z.strictObject({
  q: z.string().trim().min(2).max(100),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to search." }, { status: 401 });
  // Reading, search included, stays open to read-only (overdue or lapsed) accounts
  if ((await getAccess(session.user.id)).access === "none") return NextResponse.json({ error: "Your subscription is not active." }, { status: 403 });

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

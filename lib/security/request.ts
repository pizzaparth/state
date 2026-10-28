import { NextResponse, type NextRequest } from "next/server";

/**
 * CSRF guard for cookie-authenticated JSON endpoints. Requires an Origin header that
 * matches this deployment; browsers always send Origin on cross-site POSTs.
 */
export function rejectCrossOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  const allowed = new Set([req.nextUrl.origin]);
  if (process.env.NEXT_PUBLIC_APP_URL) allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
  if (!origin || !allowed.has(origin)) {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }
  return null;
}

/** Reads a JSON body with a hard byte cap. Returns a response on failure. */
export async function readJsonBody(
  req: NextRequest,
  maxBytes = 16 * 1024
): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    return { ok: false, response: NextResponse.json({ error: "Request body too large." }, { status: 413 }) };
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { ok: false, response: NextResponse.json({ error: "Request body too large." }, { status: 413 }) };
  }
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Request body must be JSON." }, { status: 400 }) };
  }
}

import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./index";

/**
 * Server-side session lookup for Server Components, Server Actions and Route Handlers.
 * Once per request: the layout and getViewer() both ask for it. Better Auth's cookie
 * cache (lib/auth/index.ts) usually answers without a database query.
 */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

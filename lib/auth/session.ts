import { headers } from "next/headers";
import { auth } from "./index";

/** Server-side session lookup for Server Components, Server Actions and Route Handlers. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

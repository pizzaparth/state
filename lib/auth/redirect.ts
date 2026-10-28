const PROBE_ORIGIN = "https://state.invalid";

/**
 * Same-site relative path check for post-sign-in redirects. Rejects anything a browser
 * could resolve to another origin: protocol-relative (//host), backslash variants
 * (/\host — browsers treat "\" as "/"), encoded slashes, control characters such as
 * tab/newline (stripped by the URL parser), and absolute or scheme URLs.
 */
export function isSafeRedirectPath(next: string | undefined | null): next is string {
  if (typeof next !== "string" || next.length === 0 || next.length > 2048) return false;
  if (!next.startsWith("/") || next.startsWith("//")) return false;
  const unsafe = /[\\\u0000-\u001f\u007f]/;
  if (unsafe.test(next)) return false;

  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return false;
  }
  if (decoded.startsWith("//") || unsafe.test(decoded)) return false;

  try {
    return new URL(next, PROBE_ORIGIN).origin === PROBE_ORIGIN;
  } catch {
    return false;
  }
}

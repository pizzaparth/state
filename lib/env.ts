/**
 * Fails fast at server start (instrumentation.ts) when production configuration is
 * missing or unsafe, instead of serving with a guessable secret or a localhost URL.
 */
const EXAMPLE_SECRET = "state_development_secret_key_minimum_32_characters_long_12345";

const isLocalUrl = (value: string) => {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
};

export function assertServerEnv(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "production") return;
  const problems: string[] = [];
  const secret = env.BETTER_AUTH_SECRET ?? "";
  if (secret.length < 32 || secret === EXAMPLE_SECRET) problems.push("BETTER_AUTH_SECRET must be a random value of 32+ characters (openssl rand -base64 32)");
  if (!env.DATABASE_URL) problems.push("DATABASE_URL is required");
  for (const key of ["BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL"] as const) {
    const value = env[key] ?? "";
    // Fixed public origin: auth callbacks and payment return URLs never come from the Host header
    if (!/^https:\/\//.test(value) && !isLocalUrl(value)) problems.push(`${key} must be the public https:// origin`);
  }
  const publicUrl = env.BETTER_AUTH_URL ?? "";
  if (!env.RESEND_API_KEY && !(env.EMAIL_OUTBOX_DIR && isLocalUrl(publicUrl))) problems.push("RESEND_API_KEY is required: verification and password reset emails cannot be sent");
  if (env.EMAIL_OUTBOX_DIR && !isLocalUrl(publicUrl)) problems.push("EMAIL_OUTBOX_DIR is for local test runs only; it writes single-use links to disk");
  if (env.RESEND_API_KEY && !env.EMAIL_FROM) problems.push("EMAIL_FROM is required (a sender on a domain verified with Resend)");
  if (problems.length) throw new Error(`Unsafe production configuration:\n- ${problems.join("\n- ")}`);
}

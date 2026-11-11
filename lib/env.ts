/**
 * Fails fast at server start (instrumentation.ts) when production configuration is
 * missing or unsafe, instead of serving with a guessable secret, no owner code or a
 * localhost URL.
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
  if (!env.OWNER_CODE) problems.push("OWNER_CODE is required: it is the owner's access code");
  // On Vercel the public origin defaults to the production domain; elsewhere it must be set
  const vercel = Boolean(env.VERCEL_PROJECT_PRODUCTION_URL);
  for (const key of ["BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL"] as const) {
    const value = env[key] ?? "";
    if (!value && vercel) continue;
    if (!/^https:\/\//.test(value) && !isLocalUrl(value)) problems.push(`${key} must be the public https:// origin`);
  }
  if (problems.length) throw new Error(`Unsafe production configuration:\n- ${problems.join("\n- ")}`);
}

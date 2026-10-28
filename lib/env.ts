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
  if (problems.length) throw new Error(`Unsafe production configuration:\n- ${problems.join("\n- ")}`);
}

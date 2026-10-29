import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { after } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { consumeThrottle } from "@/lib/security/throttle";
import { actionEmail, sendEmail, type Email } from "@/lib/email";

/**
 * Sends after the response: an existing and a non-existing account then answer in the
 * same time, so response timing cannot be used to enumerate emails.
 */
function deliver(message: Email) {
  const send = () => sendEmail(message).catch((error) => console.error("[email] send failed", error));
  try {
    after(send);
  } catch {
    void send(); // outside a request scope (scripts)
  }
}

// Endpoints that send mail are throttled per address as well as per IP, so nobody can
// flood one inbox from rotating addresses
const MAIL_PATHS = new Set(["/request-password-reset", "/send-verification-email"]);

export const auth = betterAuth({
  // Fixed origin for every emailed link; never derived from the Host header (reset poisoning)
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      rateLimit: schema.rateLimits,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Bounds hashing cost per request (scrypt on multi-kilobyte input is a cheap DoS)
    maxPasswordLength: 128,
    // No session until the address is proven. Sign-up for an existing email then answers
    // exactly like a new one, which also closes account enumeration at sign-up.
    requireEmailVerification: true,
    // Reset tokens: random, single-use (deleted on use), one hour
    resetPasswordTokenExpiresIn: 60 * 60,
    // A reset logs out every device, including one an attacker may hold
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      deliver(
        actionEmail({
          to: user.email,
          name: user.name,
          subject: "Reset your State password",
          intro: "Someone asked to reset the password for your State account. If it was you, choose a new password below.",
          action: "Choose a new password",
          url,
          note: "The link works once and expires in one hour. If you did not ask for this, ignore this email; your password stays the same.",
        })
      );
    },
    onExistingUserSignUp: async ({ user }) => {
      deliver(
        actionEmail({
          to: user.email,
          name: user.name,
          subject: "You already have a State account",
          intro: "Someone tried to create a State account with this email address, which already has one. No new account was created.",
          action: "Sign in",
          url: `${process.env.BETTER_AUTH_URL}/login`,
          note: "Forgot your password? Use “Forgot password” on the sign-in page. If this was not you, no action is needed.",
        })
      );
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // Unverified sign-in with the right password sends a fresh link
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      deliver(
        actionEmail({
          to: user.email,
          name: user.name,
          subject: "Verify your email for State",
          intro: "Confirm this address to finish creating your State account.",
          action: "Verify email",
          url,
          note: "The link expires in 24 hours. If you did not create a State account, ignore this email.",
        })
      );
    },
  },
  account: {
    // Stated explicitly so an upgrade cannot loosen them: an OAuth sign-in links to an
    // existing account only when both the provider and the local account verified the
    // email; no provider is trusted blindly and emails must match
    accountLinking: { enabled: true, trustedProviders: [], allowDifferentEmails: false },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },
  // Per-IP limits, stored in Postgres so they hold across serverless instances.
  // The IP comes from x-forwarded-for, which Vercel overwrites at the edge; behind any
  // other proxy, set advanced.ipAddress.trustedProxies.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 60, max: 5 },
      "/request-password-reset": { window: 60 * 60, max: 5 },
      "/send-verification-email": { window: 60 * 60, max: 5 },
      "/reset-password": { window: 60 * 15, max: 10 },
      "/verify-email": { window: 60, max: 10 },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production" && (process.env.BETTER_AUTH_URL ?? "").startsWith("https://"),
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const email = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase() : "";
      if (!email) return;
      // Per-account sign-in throttle: rotating IPs cannot bypass it (credential stuffing)
      if (ctx.path === "/sign-in/email" && !(await consumeThrottle(`sign-in:${email}`, 10, 15 * 60))) {
        throw new APIError("TOO_MANY_REQUESTS", { message: "Too many sign-in attempts. Try again in 15 minutes." });
      }
      // Keyed on the address whether or not an account exists, so the limit reveals nothing
      if (MAIL_PATHS.has(ctx.path) && !(await consumeThrottle(`mail:${email}`, 3, 60 * 60))) {
        throw new APIError("TOO_MANY_REQUESTS", { message: "Too many emails requested. Try again in an hour." });
      }
    }),
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      enabled: !!process.env.GITHUB_CLIENT_ID,
    },
  },
  // Must stay last: lets Server Actions set auth cookies
  plugins: [nextCookies()],
});

export type Auth = typeof auth;

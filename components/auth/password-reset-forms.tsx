"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { AuthField, SentNotice } from "./auth-field";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Always answers the same way, whether or not the address has an account. */
export function ForgotPasswordForm() {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!EMAIL.test(email)) {
      setError("Enter a valid email address.");
      event.currentTarget.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    setError(null);
    setPending(true);
    const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setPending(false);
    if (result.error?.status === 429) {
      setError(result.error.message ?? "Too many requests. Try again later.");
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <SentNotice title="Check your inbox">
        <p>
          If <span className="font-medium text-[#F4F4F2]">{sentTo}</span> has a State account, a link to choose a new password is on its way.
        </p>
        <p>The link works once and expires in one hour. Nothing there? Check spam.</p>
      </SentNotice>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
      <AuthField
        name="email"
        label="Email address"
        type="email"
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
        placeholder="you@domain.com…"
        error={error ?? undefined}
      />
      <Button type="submit" variant="dark-cta" size="md" className="w-full" isLoading={pending} disabled={pending}>
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<{ password?: string; confirm?: string }>({});
  const [expired, setExpired] = React.useState(false);

  // The single-use token is held in memory; take it out of the address bar and history
  React.useEffect(() => {
    window.history.replaceState(null, "", "/reset-password");
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");
    const next: typeof errors = {};
    if (password.length < 8) next.password = "Use at least 8 characters.";
    else if (password.length > 128) next.password = "Use at most 128 characters.";
    else if (confirm !== password) next.confirm = "Passwords do not match.";
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      event.currentTarget.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setPending(true);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (result.error) {
      if (result.error.code === "INVALID_TOKEN") setExpired(true);
      else setErrors({ password: result.error.message ?? "Could not change the password." });
      return;
    }
    router.replace("/login?reset=1");
  }

  if (expired) return <ExpiredLink />;

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
      <AuthField name="password" label="New password" type="password" autoComplete="new-password" placeholder="••••••••…" error={errors.password} />
      <AuthField name="confirm" label="Repeat new password" type="password" autoComplete="new-password" placeholder="••••••••…" error={errors.confirm} />
      <p className="text-xs text-[#A9A9A6]">Changing it signs you out on every device.</p>
      <Button type="submit" variant="dark-cta" size="md" className="w-full" isLoading={pending} disabled={pending}>
        Change password
      </Button>
    </form>
  );
}

export function ExpiredLink() {
  return (
    <SentNotice title="This link no longer works">
      <p>Reset links work once and expire after an hour.</p>
      <p>
        <Link href="/forgot-password" className="font-medium text-white hover:underline">
          Send a new link
        </Link>
      </p>
    </SentNotice>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { AuthField, SentNotice } from "./auth-field";

type Mode = "sign-in" | "sign-up";
type Field = "name" | "email" | "password";

function validate(mode: Mode, values: Record<Field, string>): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (mode === "sign-up" && !values.name) errors.name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Enter a valid email address.";
  if (mode === "sign-up" && values.password.length < 8) errors.password = "Use at least 8 characters.";
  if (mode === "sign-in" && !values.password) errors.password = "Enter your password.";
  return errors;
}

export function CredentialsForm({ mode, redirectTo }: { mode: Mode; redirectTo: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  // Address a verification link was just sent to (sign-up, or sign-in before verifying)
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
    };
    const nextErrors = validate(mode, values);
    setErrors(nextErrors);
    setFormError(null);
    const firstInvalid = (Object.keys(nextErrors) as Field[])[0];
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    setPending(true);
    // The emailed link signs the user in and lands here, then continues to redirectTo
    const callbackURL = `/verify-email?next=${encodeURIComponent(redirectTo)}`;
    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ name: values.name, email: values.email, password: values.password, callbackURL })
        : await authClient.signIn.email({ email: values.email, password: values.password, callbackURL });

    if (result.error) {
      setPending(false);
      if (result.error.code === "EMAIL_NOT_VERIFIED") {
        setSentTo(values.email);
        return;
      }
      setFormError(result.error.message ?? (mode === "sign-up" ? "Could not create account." : "Email or password is incorrect."));
      return;
    }
    // Sign-up never opens a session before the email is verified; existing and new
    // addresses get the same answer
    if (mode === "sign-up") {
      setSentTo(values.email);
      setPending(false);
      return;
    }
    router.replace(redirectTo as Parameters<typeof router.replace>[0]);
    router.refresh();
  }

  if (sentTo) {
    return (
      <SentNotice title={mode === "sign-up" ? "Check your inbox" : "Verify your email first"}>
        <p>
          We sent a link to <span className="font-medium text-[#F4F4F2]">{sentTo}</span>.{" "}
          {mode === "sign-up" ? "Open it to verify your address and continue to your plan." : "Open it to verify your address; it signs you in."}
        </p>
        <p>The link expires in 24 hours. Nothing there? Check spam, or sign in again to get a new one.</p>
      </SentNotice>
    );
  }

  const field = (name: Field, label: string, props: React.InputHTMLAttributes<HTMLInputElement>, aside?: React.ReactNode) => (
    <AuthField name={name} label={label} error={errors[name]} aside={aside} {...props} />
  );

  return (
    <form ref={formRef} method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
      {mode === "sign-up" && field("name", "Name", { type: "text", autoComplete: "name", placeholder: "Ada Lovelace…" })}
      {field("email", "Email", {
        type: "email",
        autoComplete: "email",
        inputMode: "email",
        spellCheck: false,
        placeholder: "you@domain.com…",
      })}
      {field(
        "password",
        "Password",
        {
          type: "password",
          autoComplete: mode === "sign-up" ? "new-password" : "current-password",
          placeholder: "••••••••…",
        },
        mode === "sign-in" && (
          <Link href="/forgot-password" className="text-xs text-[#A9A9A6] hover:text-white hover:underline">
            Forgot password?
          </Link>
        )
      )}
      <p aria-live="polite" className="min-h-4 text-sm text-[#E5A3A3]">
        {formError}
      </p>
      <Button type="submit" variant="dark-cta" size="md" className="w-full" isLoading={pending} disabled={pending}>
        {mode === "sign-up" ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}

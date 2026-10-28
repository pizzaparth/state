"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

const inputClasses =
  "w-full h-11 px-4 text-sm bg-[#151515] text-[#F4F4F2] rounded-input border border-white/[0.1] focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 placeholder:text-[#6F6F6B] transition-[border-color,box-shadow] touch-manipulation aria-[invalid=true]:border-[#E5A3A3]/60";

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
    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ name: values.name, email: values.email, password: values.password })
        : await authClient.signIn.email({ email: values.email, password: values.password });

    if (result.error) {
      setFormError(result.error.message ?? (mode === "sign-up" ? "Could not create account." : "Email or password is incorrect."));
      setPending(false);
      return;
    }
    router.replace(redirectTo as Parameters<typeof router.replace>[0]);
    router.refresh();
  }

  const field = (name: Field, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-xs font-medium text-[#A9A9A6]">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        className={inputClasses}
        {...props}
      />
      {errors[name] && (
        <p id={`${name}-error`} className="text-xs text-[#E5A3A3]">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
      {mode === "sign-up" && field("name", "Full name", { type: "text", autoComplete: "name", placeholder: "Ada Lovelace…" })}
      {field("email", "Email address", {
        type: "email",
        autoComplete: "email",
        inputMode: "email",
        spellCheck: false,
        placeholder: "you@domain.com…",
      })}
      {field("password", "Password", {
        type: "password",
        autoComplete: mode === "sign-up" ? "new-password" : "current-password",
        placeholder: "••••••••…",
      })}
      <p aria-live="polite" className="min-h-4 text-xs text-[#E5A3A3]">
        {formError}
      </p>
      <Button type="submit" variant="dark-cta" size="md" className="w-full" isLoading={pending} disabled={pending}>
        {mode === "sign-up" ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}

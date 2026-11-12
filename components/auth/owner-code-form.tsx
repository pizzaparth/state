"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { signInOwnerAction } from "@/app/(auth)/actions";
import { isSafeRedirectPath } from "@/lib/auth/redirect";
import { AuthField } from "./auth-field";

/** Where to go after sign-in: a safe ?next= product path, else Today. */
function redirectTarget(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return isSafeRedirectPath(next) && next.startsWith("/platform") ? next : "/platform";
}

/** One field: the owner's access code. The session lasts until the browser closes. */
export function OwnerCodeForm() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, []);

  return (
    <form
      method="post"
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const code = String(new FormData(event.currentTarget).get("code") ?? "");
        startTransition(async () => {
          const result = await signInOwnerAction({ code });
          if (!result.ok) {
            setError(result.error);
            inputRef.current?.focus();
            return;
          }
          try {
            sessionStorage.removeItem("state.demo");
          } catch {}
          router.replace(redirectTarget() as Route);
          router.refresh();
        });
      }}
    >
      <AuthField
        ref={inputRef}
        name="code"
        label="Access code"
        type="password"
        autoComplete="current-password"
        spellCheck={false}
        autoCapitalize="none"
        placeholder="••••••••…"
        error={error ?? undefined}
        onChange={() => setError(null)}
      />
      <Button type="submit" variant="light-cta" size="md" className="w-full" isLoading={pending}>
        Sign in
      </Button>
    </form>
  );
}

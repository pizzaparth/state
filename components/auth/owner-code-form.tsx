"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { signInOwnerAction } from "@/app/(auth)/actions";
import { AuthField } from "./auth-field";

/** One field: the owner's access code. The session lasts until the browser closes. */
export function OwnerCodeForm({ redirectTo }: { redirectTo: string }) {
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
          router.replace(redirectTo as Route);
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
      <Button type="submit" variant="dark-cta" size="md" className="w-full" isLoading={pending}>
        Sign in
      </Button>
    </form>
  );
}

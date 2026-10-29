"use client";

import * as React from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);
  return (
    <button
      type="button"
      disabled={signingOut}
      onClick={async () => {
        setSigningOut(true);
        await authClient.signOut();
        router.replace("/login" as Route);
        router.refresh();
      }}
      className="app-btn inline-flex h-10 items-center gap-2 rounded-[12px] px-4 text-base font-medium disabled:opacity-70"
    >
      {signingOut ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
      Sign out
    </button>
  );
}

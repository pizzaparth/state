"use client";

import * as React from "react";
import { Loader2, LogOut } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { clearDemoTab } from "@/lib/demo/tab";
import { useNotice } from "./notice";

/** Signs out and returns to the landing page. A demo is deleted on the way. */
export function SignOutButton({ demo = false, className }: { demo?: boolean; className?: string }) {
  const [signingOut, setSigningOut] = React.useState(false);
  const notify = useNotice();
  return (
    <button
      type="button"
      disabled={signingOut}
      onClick={async () => {
        setSigningOut(true);
        const result = await signOutAction();
        if (!result.ok) {
          setSigningOut(false);
          notify("Could not sign out. Try again.");
          return;
        }
        clearDemoTab();
        // Full load: no product page stays in the client router cache
        window.location.replace(demo ? "/?demo=ended" : "/");
      }}
      className={className ?? "app-btn mi-nudge inline-flex h-10 items-center gap-2 rounded-[12px] px-4 text-base font-medium disabled:opacity-70"}
    >
      {signingOut ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
      {demo ? "End demo" : "Sign out"}
    </button>
  );
}

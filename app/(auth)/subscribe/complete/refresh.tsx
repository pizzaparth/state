"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export function RefreshUntilActive({ everyMs = 2500 }: { everyMs?: number }) {
  const router = useRouter();
  React.useEffect(() => {
    const id = window.setInterval(() => router.refresh(), everyMs);
    return () => window.clearInterval(id);
  }, [router, everyMs]);
  return null;
}

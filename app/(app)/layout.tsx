import * as React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { getViewer } from "@/lib/viewer";
import { isDemoRequest } from "@/lib/demo/mode";
import { loadShellData } from "@/lib/shell-data";
import { AppShell } from "@/components/app/shell";
import { DemoRoot } from "@/components/app/demo/demo-entry";

// `.platform` switches styles/tokens.css to the product theme (soft raised surfaces, blue
// accent). It is a marker only (display: contents); the landing page keeps its own look.

// Signed-in product pages never belong in search results
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Product pages render per request: the nonce CSP in middleware.ts needs a fresh nonce
  // on each response. Marketing and auth pages are prerendered (static CSP, next.config.ts).
  await connection();
  const sidebarCollapsed = (await cookies()).get("sidebar")?.value === "collapsed";

  // A demo's data lives in its browser: the shell and pages load there (DemoRoot)
  if (await isDemoRequest()) {
    return (
      <div className="platform contents">
        <DemoRoot sidebarCollapsed={sidebarCollapsed} renderedAt={Date.now()}>
          {children}
        </DemoRoot>
      </div>
    );
  }

  const session = await getSession();
  if (!session) redirect("/login");
  const viewer = await getViewer();
  return (
    <div className="platform contents">
      <AppShell data={await loadShellData(viewer, { sidebarCollapsed, demoId: null })}>{children}</AppShell>
    </div>
  );
}

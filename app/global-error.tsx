"use client";

import * as React from "react";

/**
 * Failure in the root layout itself: no fonts, styles or shell are available, so this
 * page carries its own minimal markup. The digest goes to the console only.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error("[app] root error", error.digest ?? "no digest");
  }, [error]);
  return (
    <html lang="en" style={{ colorScheme: "light" }}>
      <body style={{ margin: 0, background: "#FFFFFF", color: "#0A0A0A", fontFamily: "system-ui, sans-serif" }}>
        <title>Something broke — State</title>
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: "0 16px", textAlign: "center" }}>
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#C21F63" }}>Error</p>
          <h1 style={{ fontSize: 40, letterSpacing: "-0.04em", margin: "12px 0 32px" }}>Something broke</h1>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{ height: 44, padding: "0 16px", borderRadius: 12, border: 0, background: "#D92B74", color: "#FFFFFF", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
            <a href="/platform/today" style={{ height: 44, padding: "0 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,.1)", color: "#0A0A0A", fontSize: 16, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              Open Today
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}

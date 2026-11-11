import { ImageResponse } from "next/og";

// Shared preview card for links to any page (search, chat apps, social)
export const alt = "State — To-do list and kanban app that measures your work";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#050505",
          color: "#F4F4F2",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, color: "#85857F" }}>STATE · BY PARTH PANCHOLI</div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 128, fontWeight: 800, lineHeight: 0.9, letterSpacing: -4 }}>
          <span>EXECUTION,</span>
          <span>MEASURED.</span>
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#A9A9A6" }}>A personal hobby project · Take a demo</div>
      </div>
    ),
    size
  );
}

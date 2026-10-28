import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "State — Execution, measured.",
  description:
    "A quantitative execution system for individuals and organisations. Tasks represent intent. Commits represent executed work. State measures the difference.",
  keywords: ["execution system", "quantitative productivity", "kanban", "commits", "velocity", "throughput"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#D9D9D5] text-[#171717] antialiased selection:bg-black selection:text-white">
        {children}
      </body>
    </html>
  );
}

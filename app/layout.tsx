import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Michroma } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "@/styles/globals.css";

// Brand typeface for the whole product (single 400 weight; hierarchy comes from size)
const michroma = Michroma({ subsets: ["latin"], weight: "400", variable: "--font-michroma", display: "swap" });

export const metadata: Metadata = {
  title: "State — Execution, measured.",
  description:
    "A quantitative execution system for individuals and organisations. Tasks represent intent. Commits represent executed work. State measures the difference.",
  keywords: ["execution system", "quantitative productivity", "kanban", "commits", "velocity", "throughput"],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
    { media: "(prefers-color-scheme: light)", color: "#D9D9D5" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Per-request rendering for every page: the nonce CSP in middleware.ts needs a fresh
  // nonce on each response, which a prerendered page cannot carry
  await connection();

  return (
    <html lang="en" className={`${michroma.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen font-sans bg-[#D9D9D5] text-[#171717] antialiased selection:bg-black selection:text-white">
        {children}
      </body>
    </html>
  );
}

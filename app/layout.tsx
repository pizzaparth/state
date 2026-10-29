import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { archivo } from "@/lib/fonts";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "State — Execution, measured.",
  description:
    "A quantitative execution system for individuals and organisations. Tasks represent intent. Commits represent executed work. State measures the difference.",
  keywords: ["execution system", "quantitative productivity", "kanban", "commits", "velocity", "throughput"],
};

export const viewport: Viewport = {
  // Every surface is dark: near-black marketing, AMOLED black product
  themeColor: "#000000",
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
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${archivo.variable}`}>
      <body className="min-h-screen font-sans bg-black text-[#F2F2EF] antialiased selection:bg-white selection:text-black">
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { archivo } from "@/lib/fonts";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  // Every surface is navy (#001A33)
  themeColor: "#001A33",
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
      <body className="min-h-screen font-sans bg-[#001A33] text-[#FFFFFF] antialiased selection:bg-accent selection:text-accent-ink">
        {children}
      </body>
    </html>
  );
}

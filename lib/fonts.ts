import { Archivo } from "next/font/google";

// Expanded grotesk for display type (landing headlines, product titles and big numbers);
// the wdth axis drives font-stretch
export const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

import { renderPage, type PageProps } from "@/lib/pages/render";

export const metadata = { title: "Today" };

export default function Page(props: PageProps) {
  return renderPage("today", props);
}

import { renderPage, type PageProps } from "@/lib/pages/render";

export const metadata = { title: "History" };

export default function Page(props: PageProps) {
  return renderPage("history", props);
}

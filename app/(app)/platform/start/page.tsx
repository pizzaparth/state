import { renderPage, type PageProps } from "@/lib/pages/render";

export const metadata = { title: "Set up" };

export default function Page(props: PageProps) {
  return renderPage("start", props);
}

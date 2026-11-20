import { renderPage, type PageProps } from "@/lib/pages/render";

export const metadata = { title: "Board" };

export default function Page(props: PageProps) {
  return renderPage("board", props);
}

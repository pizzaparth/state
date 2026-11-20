import { renderPage, type PageProps } from "@/lib/pages/render";

export const metadata = { title: "Inbox" };

export default function Page(props: PageProps) {
  return renderPage("inbox", props);
}

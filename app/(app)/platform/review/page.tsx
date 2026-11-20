import { renderPage, type PageProps } from "@/lib/pages/render";

export const metadata = { title: "Week review" };

export default function Page(props: PageProps) {
  return renderPage("review", props);
}

import { renderPage, type PageProps } from "@/lib/pages/render";

export const metadata = { title: "Projects" };

export default function Page(props: PageProps) {
  return renderPage("projects", props);
}

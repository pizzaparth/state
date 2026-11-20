import { renderPage, type PageProps } from "@/lib/pages/render";

export default function Page(props: PageProps) {
  return renderPage("project", props);
}

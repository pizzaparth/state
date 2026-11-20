import { renderPage, type PageProps } from "@/lib/pages/render";

export const metadata = { title: "Metrics" };

export default function Page(props: PageProps) {
  return renderPage("metrics", props);
}

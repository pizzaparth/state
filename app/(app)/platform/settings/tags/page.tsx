import { renderPage, type PageProps } from "@/lib/pages/render";

export const metadata = { title: "Tags" };

export default function Page(props: PageProps) {
  return renderPage("settings-tags", props);
}

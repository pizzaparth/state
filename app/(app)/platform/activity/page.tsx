import { renderPage, type PageProps } from "@/lib/pages/render";

export const metadata = { title: "Activity" };

export default function Page(props: PageProps) {
  return renderPage("activity", props);
}

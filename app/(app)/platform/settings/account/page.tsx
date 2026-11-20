import { renderPage, type PageProps } from "@/lib/pages/render";

export const metadata = { title: "Account" };

export default function Page(props: PageProps) {
  return renderPage("settings-account", props);
}

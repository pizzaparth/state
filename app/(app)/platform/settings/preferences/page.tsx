import { renderPage, type PageProps } from "@/lib/pages/render";

export const metadata = { title: "Preferences" };

export default function Page(props: PageProps) {
  return renderPage("settings-preferences", props);
}

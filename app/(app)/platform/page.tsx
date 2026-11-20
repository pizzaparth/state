import { renderPage, type PageProps } from "@/lib/pages/render";

/** /platform opens the start page chosen in Preferences. */
export default function Page(props: PageProps) {
  return renderPage("index", props);
}

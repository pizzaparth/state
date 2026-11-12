import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";

/** /platform opens the start page chosen in Preferences. */
export default async function PlatformIndex() {
  const viewer = await getViewer();
  redirect(`/platform/${viewer.preferences.startPage}`);
}

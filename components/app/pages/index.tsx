import { definePage, type PageContext } from "@/lib/pages/types";

/** /platform opens the start page chosen in Preferences. */
async function load({ viewer }: PageContext) {
  return { redirect: `/platform/${viewer.preferences.startPage}` };
}

function View() {
  return null;
}

export default definePage<Record<string, never>>({ load, View });

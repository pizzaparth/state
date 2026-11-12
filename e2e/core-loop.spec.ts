import { expect, test, type Page } from "@playwright/test";

/**
 * capture → move to board → Done → commit on Today, History and the graph → reopen →
 * commit gone. Runs in a throwaway demo session (deleted when the context closes).
 */

async function startDemo(page: Page) {
  await page.goto("/demo");
  await page.waitForURL(/\/platform\/(today|start)/, { timeout: 60_000 });
}

test("a task's commit comes and goes with Done", async ({ page }, info) => {
  const title = `E2E ${info.project.name} ${Date.now()}`;
  await startDemo(page);

  // Capture into the Inbox, with a weight token
  await page.goto("/platform/inbox");
  await page.getByLabel("Capture a task").fill(`${title} +4`);
  await page.keyboard.press("Enter");
  const row = page.locator("li[data-task-id]", { hasText: title });
  await expect(row).toBeVisible();

  // Queue it onto the board
  await row.hover();
  await row.getByRole("button", { name: `Queue “${title}”` }).click();
  await expect(row).toHaveCount(0);

  // Done on the board (phones show Queued first)
  await page.goto("/platform/board");
  const card = page.locator("[data-card-id]", { hasText: title });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: `Mark “${title}” done` }).click();
  await expect(page.getByText("Done. +4.")).toBeVisible();

  // The commit is on Today, in History (today's day) and counted in the graph readout
  await page.goto("/platform/today");
  await expect(page.getByRole("region", { name: /Today’s commits/i }).or(page.locator("section", { hasText: "Today’s commits" })).getByText(title).first()).toBeVisible();
  const today = await page.evaluate(() => new Intl.DateTimeFormat("en-CA").format(new Date()));
  await page.goto(`/platform/history?day=${today}`);
  await expect(page.getByText(title).first()).toBeVisible();
  await page.goto("/platform/activity?range=30d");
  await expect(page.locator('[aria-label^="Execution graph"]')).toBeVisible();

  // Reopen from Today's Completed list: the commit is withdrawn
  await page.goto("/platform/today");
  await page.locator("section", { hasText: "Completed today" }).getByRole("link", { name: new RegExp(title) }).click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("radio", { name: "Queued" }).click();
  await expect(page.getByText(/Reopened\. Its commit was withdrawn\./)).toBeVisible();
  await page.goto(`/platform/history?day=${today}`);
  await expect(page.getByText(title)).toHaveCount(0);
});

import { expect, test } from "@playwright/test";

test("sends a prompt in search mode", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What are we building?" })).toBeVisible();
  await page.getByRole("button", { name: "Search mode" }).click();
  await expect(page.getByLabel("Prompt")).toHaveAttribute("placeholder", "Search the web...");
  await page.getByLabel("Prompt").fill("Find the most relevant source");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByText("[Search: Find the most relevant source]", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Prompt")).toHaveValue("");
  expect(consoleErrors).toEqual([]);
});

test("handles voice mode and an invalid file on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await page.getByRole("button", { name: "Start voice message" }).click();
  await expect(page.getByRole("button", { name: "Stop recording" })).toBeVisible();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.getByText(/\[Voice message - [1-9]\d* seconds\]/)).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByText("Only image files are supported.", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  await page.screenshot({ path: "/tmp/ai-prompt-mobile.png", fullPage: true });
});

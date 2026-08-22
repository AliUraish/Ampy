import { expect, test } from "@playwright/test";

test("returns five live product images as the main result", async ({ page }) => {
  test.setTimeout(100_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find your next favorite thing." })).toBeVisible();
  await expect(page.getByLabel("Prompt")).toHaveAttribute("placeholder", "what products can i search for you");
  await page.getByLabel("Prompt").fill("wireless mechanical keyboard under 100 dollars");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByText("wireless mechanical keyboard under 100 dollars", { exact: true })).toBeVisible();
  const successMessage = page.getByText("I found five products for you.", { exact: true });
  await expect(successMessage.or(page.getByRole("alert"))).toBeVisible({ timeout: 90_000 });
  await expect(successMessage).toBeVisible();
  const productImages = page.locator('a[target="_blank"] img');
  await expect(productImages).toHaveCount(5);
  await expect.poll(async () => productImages.evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(page.getByLabel("Prompt")).toHaveValue("");
  expect(consoleErrors).toEqual([]);
});

test("handles an invalid file without overflowing on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByText("Only image files are supported.", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

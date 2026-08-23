import { expect, test } from "@playwright/test";

test("buyer: returns Craigslist listings and shows the selected product", async ({ page }) => {
  test.setTimeout(100_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "Buyer" }).click();
  await expect(page.getByRole("heading", { name: "Tell me what to buy." })).toBeVisible();
  await expect(page.getByLabel("Prompt")).toHaveAttribute("placeholder", "What do you want to buy?");
  await page.getByLabel("Prompt").fill("bike");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByText("bike", { exact: true })).toBeVisible();
  const successMessage = page.getByText(/Found \d+ listings? on /);
  await expect(successMessage.or(page.getByRole("alert"))).toBeVisible({ timeout: 90_000 });
  await expect(successMessage).toBeVisible();
  const productImages = page.locator('[data-testid="product-card"] img');
  await expect(productImages).not.toHaveCount(0);
  await expect(page.getByLabel("Prompt")).toHaveValue("");

  await page.locator('[data-testid="product-card"]').first().click();
  await expect(page.getByTestId("buy-panel")).toBeVisible();
  await expect(page.getByRole("button", { name: /Deploy my buying agent/ })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("seller: publishes a listing and the six-agent simulation starts", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Put it on the marketplace." })).toBeVisible();
  const publish = page.getByRole("button", { name: "Publish & start simulation" });
  await expect(publish).toBeDisabled();

  await page.getByLabel("Title").fill("Test bike");
  await page.getByLabel("Upper bound · asking price (USD)").fill("300");
  await page.getByLabel("Lower bound · won't go below (USD)").fill("350");
  await expect(page.getByText("The lower bound must be at or below the upper bound.")).toBeVisible();
  await page.getByLabel("Lower bound · won't go below (USD)").fill("220");
  await expect(publish).toBeEnabled();
  await publish.click();

  await expect(page.getByTestId("seller-simulation")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Asking \$300 · floor \$220/)).toBeVisible();
  await expect(page.getByText("Maya")).toBeVisible();
  await expect(page.getByText(/Seller agent live · sold 0\/1/)).toBeVisible();
});

test("buyer: handles an invalid file without overflowing on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("tab", { name: "Buyer" }).click();

  await page.locator('#panel-buyer input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByText("Only image files are supported.", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("reseller: renders the Deal Finder scan bar and starts a scan", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("tab", { name: "Reseller" }).click();
  await expect(page.getByRole("heading", { name: "Find the deal before everyone else." })).toBeVisible();
  await expect(page.getByLabel("Search target")).toHaveValue("road bike");
  await expect(page.getByLabel("Maximum price in dollars")).toHaveValue("400");
  await page.getByRole("button", { name: "Find deals" }).click();
  await expect(page.getByRole("button", { name: "Searching…" })).toBeDisabled();
  await expect(page.getByText("scan initialized · United States / general / “road bike”")).toBeVisible();
  await expect(page.getByText(/listings found|unavailable/).first()).toBeVisible({ timeout: 90_000 });
});

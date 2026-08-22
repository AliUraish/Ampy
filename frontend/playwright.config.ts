import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3002",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});

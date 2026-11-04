import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 180000,
  expect: { timeout: 10000 },
  workers: 1,
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1440, height: 1050 },
    launchOptions: { args: ["--no-sandbox"] },
    trace: "retain-on-failure",
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "qa/playwright-report" }],
    ["json", { outputFile: "qa/results.json" }],
  ],
});

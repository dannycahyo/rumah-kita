import { defineConfig, devices } from "@playwright/test";

/** Prototipe: satu berkas smoke test, dijalankan pada viewport ponsel. */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
    ...devices["Desktop Chrome"],
    // Ponsel: 390x844 (iPhone 14) tetapi memakai Chromium.
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    trace: "retain-on-failure",
  },
});

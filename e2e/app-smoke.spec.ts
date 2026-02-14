import { expect } from "@playwright/test";
import { setupApp } from "./fixtures";
import { test } from "./fixtures";

test.describe("App smoke tests", () => {
  test("shows loading screen while connecting", async ({ page }) => {
    await setupApp(page, {
      handlers: { connect: { __pending: true } },
    });

    await expect(page.getByText("Connecting to Telegram")).toBeVisible();
  });

  test("shows login form when not authenticated", async ({ page }) => {
    await setupApp(page, {
      handlers: { connect: false },
    });

    await expect(page.getByPlaceholder("+1 234 567 8900")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  test("shows main layout when authenticated", async ({ page }) => {
    await setupApp(page, {
      settings: { onboardingCompleted: true },
    });

    await expect(page.getByText("Telegram Copilot")).toBeVisible();

    // All 6 nav tabs should be visible
    for (const tab of ["Briefing", "Summary", "Chats", "Contacts", "Outreach", "Offboard"]) {
      await expect(page.getByRole("button", { name: tab })).toBeVisible();
    }
  });

  test("shows onboarding for first-time users", async ({ page }) => {
    await setupApp(page, {
      settings: { onboardingCompleted: false },
    });

    await expect(page.getByRole("button", { name: /Get Started/ })).toBeVisible();
  });

  test("navigates between all views", async ({ page }) => {
    await setupApp(page, {
      settings: { onboardingCompleted: true },
    });

    // Wait for main layout
    await expect(page.getByText("Telegram Copilot")).toBeVisible();

    const tabs = ["Summary", "Chats", "Contacts", "Outreach", "Offboard", "Briefing"];
    for (const tab of tabs) {
      const button = page.getByRole("button", { name: tab });
      await button.click();
      // Verify the tab becomes active (has primary background class)
      await expect(button).toHaveClass(/bg-primary/);
    }
  });
});

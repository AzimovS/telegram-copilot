import { expect } from "@playwright/test";
import { setupApp } from "./fixtures";
import { test } from "./fixtures";

const MOCK_CHATS = [
  { id: 1, type: "private", title: "Alice", unreadCount: 2, isPinned: true, order: 0 },
  { id: 2, type: "group", title: "Dev Team", unreadCount: 10, isPinned: false, order: 1 },
  { id: 3, type: "channel", title: "News Channel", unreadCount: 0, isPinned: false, order: 2 },
  { id: 4, type: "private", title: "Bob", unreadCount: 0, isPinned: false, order: 3 },
  { id: 5, type: "group", title: "Design Team", unreadCount: 5, isPinned: false, order: 4 },
];

test.describe("Chat list", () => {
  test("renders chat items", async ({ page }) => {
    await setupApp(page, {
      handlers: { get_chats: MOCK_CHATS },
      settings: { onboardingCompleted: true },
    });

    // Navigate to chats tab
    await page.getByRole("button", { name: "Chats" }).click();

    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("Dev Team")).toBeVisible();
    await expect(page.getByText("News Channel")).toBeVisible();
  });

  test("search filters chats", async ({ page }) => {
    await setupApp(page, {
      handlers: { get_chats: MOCK_CHATS },
      settings: { onboardingCompleted: true },
    });

    await page.getByRole("button", { name: "Chats" }).click();

    // Wait for chats to load
    await expect(page.getByText("Alice")).toBeVisible();

    // Search for "team"
    await page.getByPlaceholder("Search chats...").fill("team");

    await expect(page.getByText("Dev Team")).toBeVisible();
    await expect(page.getByText("Design Team")).toBeVisible();
    await expect(page.getByText("Alice")).not.toBeVisible();
    await expect(page.getByText("News Channel")).not.toBeVisible();
  });

  test("type filter buttons work", async ({ page }) => {
    await setupApp(page, {
      handlers: { get_chats: MOCK_CHATS },
      settings: { onboardingCompleted: true },
    });

    await page.getByRole("button", { name: "Chats" }).click();

    // Wait for chats to load
    await expect(page.getByText("Alice")).toBeVisible();

    // Click Groups filter
    await page.getByRole("button", { name: /Groups/ }).click();

    await expect(page.getByText("Dev Team")).toBeVisible();
    await expect(page.getByText("Design Team")).toBeVisible();
    await expect(page.getByText("Alice")).not.toBeVisible();
    await expect(page.getByText("News Channel")).not.toBeVisible();
  });
});

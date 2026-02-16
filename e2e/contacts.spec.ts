import { expect } from "@playwright/test";
import { setupApp } from "./fixtures";
import { test } from "./fixtures";

const MOCK_CONTACTS = {
  contacts: [
    { userId: 1, firstName: "Alice", lastName: "Smith", username: "alice", tags: ["builder"], notes: "" },
    { userId: 2, firstName: "Bob", lastName: "Jones", username: "bob", tags: ["investor"], notes: "" },
    { userId: 3, firstName: "Charlie", lastName: "Brown", username: "charlie", tags: [], notes: "" },
  ],
  cached: false,
  cacheAge: null,
};

test.describe("Contacts view", () => {
  test("renders contact list", async ({ page }) => {
    await setupApp(page, {
      handlers: { get_contacts: MOCK_CONTACTS },
      settings: { onboardingCompleted: true },
    });

    // Navigate to contacts tab
    await page.getByRole("button", { name: "Contacts" }).click();

    await expect(page.getByText("Alice Smith")).toBeVisible();
    await expect(page.getByText("Bob Jones")).toBeVisible();
    await expect(page.getByText("Charlie Brown")).toBeVisible();
  });

  test("search filters contacts", async ({ page }) => {
    await setupApp(page, {
      handlers: { get_contacts: MOCK_CONTACTS },
      settings: { onboardingCompleted: true },
    });

    await page.getByRole("button", { name: "Contacts" }).click();

    // Wait for contacts to load
    await expect(page.getByText("Alice Smith")).toBeVisible();

    // Search for "bob"
    await page.getByPlaceholder(/search/i).fill("bob");

    await expect(page.getByText("Bob Jones")).toBeVisible();
    await expect(page.getByText("Alice Smith")).not.toBeVisible();
    await expect(page.getByText("Charlie Brown")).not.toBeVisible();
  });

  test("shows contact count", async ({ page }) => {
    await setupApp(page, {
      handlers: { get_contacts: MOCK_CONTACTS },
      settings: { onboardingCompleted: true },
    });

    await page.getByRole("button", { name: "Contacts" }).click();

    await expect(page.getByText("Contacts (3)")).toBeVisible();
  });
});

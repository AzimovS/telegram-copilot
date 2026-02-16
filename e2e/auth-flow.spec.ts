import { expect } from "@playwright/test";
import { setupApp } from "./fixtures";
import { test } from "./fixtures";

test.describe("Authentication flow", () => {
  test("phone → code → authenticated", async ({ page }) => {
    await setupApp(page, {
      handlers: {
        connect: false,
        send_phone_number: null,
        send_auth_code: null,
      },
      settings: { onboardingCompleted: true },
    });

    // Should start at phone input
    const phoneInput = page.getByPlaceholder("+1 234 567 8900");
    await expect(phoneInput).toBeVisible();

    // Enter phone number and submit
    await phoneInput.fill("+1234567890");
    await page.getByRole("button", { name: "Continue" }).click();

    // Should transition to code input
    const codeInput = page.getByPlaceholder("12345");
    await expect(codeInput).toBeVisible();

    // Enter code and submit
    await codeInput.fill("99999");
    await page.getByRole("button", { name: "Verify" }).click();

    // Should reach main layout
    await expect(page.getByText("Telegram Copilot")).toBeVisible();
  });

  test("2FA password flow", async ({ page }) => {
    await setupApp(page, {
      handlers: {
        connect: false,
        send_phone_number: null,
        send_auth_code: { __error: "2FA required. Hint: pet name" },
        send_password: null,
      },
      settings: { onboardingCompleted: true },
    });

    // Submit phone
    await page.getByPlaceholder("+1 234 567 8900").fill("+1234567890");
    await page.getByRole("button", { name: "Continue" }).click();

    // Submit code — should trigger 2FA
    const codeInput = page.getByPlaceholder("12345");
    await expect(codeInput).toBeVisible();
    await codeInput.fill("12345");
    await page.getByRole("button", { name: "Verify" }).click();

    // Should show password input with hint
    await expect(page.getByText("Two-Factor Authentication")).toBeVisible();
    await expect(page.getByText("Hint: pet name")).toBeVisible();

    // Submit password
    await page.getByPlaceholder("Password").fill("mypassword");
    await page.getByRole("button", { name: "Continue" }).click();

    // Should reach main layout
    await expect(page.getByText("Telegram Copilot")).toBeVisible();
  });

  test("invalid code shows error", async ({ page }) => {
    await setupApp(page, {
      handlers: {
        connect: false,
        send_phone_number: null,
        send_auth_code: { __error: "Invalid code" },
      },
    });

    // Submit phone
    await page.getByPlaceholder("+1 234 567 8900").fill("+1234567890");
    await page.getByRole("button", { name: "Continue" }).click();

    // Submit code
    const codeInput = page.getByPlaceholder("12345");
    await expect(codeInput).toBeVisible();
    await codeInput.fill("00000");
    await page.getByRole("button", { name: "Verify" }).click();

    // Error should appear, still on code screen
    await expect(page.getByText("Invalid code")).toBeVisible();
    await expect(codeInput).toBeVisible();
  });

  test("session expired resets to phone input", async ({ page }) => {
    await setupApp(page, {
      handlers: {
        connect: false,
        send_phone_number: null,
        send_auth_code: { __error: "No login token" },
      },
    });

    // Submit phone
    await page.getByPlaceholder("+1 234 567 8900").fill("+1234567890");
    await page.getByRole("button", { name: "Continue" }).click();

    // Submit code
    const codeInput = page.getByPlaceholder("12345");
    await expect(codeInput).toBeVisible();
    await codeInput.fill("12345");
    await page.getByRole("button", { name: "Verify" }).click();

    // Should reset to phone input with session expired message
    await expect(page.getByPlaceholder("+1 234 567 8900")).toBeVisible();
    await expect(page.getByText("Session expired")).toBeVisible();
  });
});

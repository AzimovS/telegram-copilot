import { expect } from "@playwright/test";
import { setupApp } from "./fixtures";
import { test } from "./fixtures";

test.describe("Briefing view", () => {
  test("renders empty state", async ({ page }) => {
    await setupApp(page, {
      settings: { onboardingCompleted: true },
    });

    await expect(page.getByText("All caught up!")).toBeVisible();
  });

  test("renders needs-response cards", async ({ page }) => {
    await setupApp(page, {
      handlers: {
        get_chats: [
          { id: 100, type: "private", title: "Alice", unreadCount: 3, isPinned: false, order: 0 },
        ],
        get_batch_messages: [
          {
            chatId: 100,
            messages: [
              {
                id: 1,
                chatId: 100,
                senderId: 2,
                senderName: "Alice",
                content: { type: "text", text: "Hey, are you free?" },
                date: Math.floor(Date.now() / 1000),
                isOutgoing: false,
                isRead: false,
              },
            ],
            error: null,
          },
        ],
        generate_briefing_v2: {
          needs_response: [
            {
              id: 1,
              chat_id: 100,
              chat_name: "Alice",
              chat_type: "dm",
              unread_count: 3,
              last_message: "Hey, are you free?",
              last_message_date: new Date().toISOString(),
              priority: "needs_reply",
              summary: "Alice is asking about availability",
              suggested_reply: "Yes, I'm free!",
            },
          ],
          fyi_summaries: [],
          stats: { needs_response_count: 1, fyi_count: 0, total_unread: 3 },
          generated_at: new Date().toISOString(),
          cached: false,
        },
      },
      settings: { onboardingCompleted: true },
    });

    await expect(page.getByRole("heading", { name: "Alice" })).toBeVisible();
    await expect(page.getByText("Alice is asking about availability")).toBeVisible();
    await expect(page.getByText("Needs Reply (1)")).toBeVisible();
  });

  test("renders FYI section", async ({ page }) => {
    await setupApp(page, {
      handlers: {
        get_chats: [
          { id: 200, type: "group", title: "Dev Group", unreadCount: 15, isPinned: false, order: 0 },
        ],
        get_batch_messages: [
          {
            chatId: 200,
            messages: [
              {
                id: 2,
                chatId: 200,
                senderId: 3,
                senderName: "Bob",
                content: { type: "text", text: "New release published" },
                date: Math.floor(Date.now() / 1000),
                isOutgoing: false,
                isRead: false,
              },
            ],
            error: null,
          },
        ],
        generate_briefing_v2: {
          needs_response: [],
          fyi_summaries: [
            {
              id: 2,
              chat_id: 200,
              chat_name: "Dev Group",
              chat_type: "group",
              unread_count: 15,
              last_message: "New release published",
              last_message_date: new Date().toISOString(),
              priority: "fyi",
              summary: "Team discussing new release",
            },
          ],
          stats: { needs_response_count: 0, fyi_count: 1, total_unread: 15 },
          generated_at: new Date().toISOString(),
          cached: false,
        },
      },
      settings: { onboardingCompleted: true },
    });

    await expect(page.getByText("FYI (1)")).toBeVisible();
    await expect(page.getByText("Dev Group")).toBeVisible();
    await expect(page.getByText("Team discussing new release")).toBeVisible();
  });

  test("shows error on AI failure", async ({ page }) => {
    await setupApp(page, {
      handlers: {
        get_chats: [
          { id: 100, type: "private", title: "Alice", unreadCount: 3, isPinned: false, order: 0 },
        ],
        get_batch_messages: [
          {
            chatId: 100,
            messages: [
              {
                id: 1,
                chatId: 100,
                senderId: 2,
                senderName: "Alice",
                content: { type: "text", text: "Hello" },
                date: Math.floor(Date.now() / 1000),
                isOutgoing: false,
                isRead: false,
              },
            ],
            error: null,
          },
        ],
        generate_briefing_v2: { __error: "API key invalid" },
      },
      settings: { onboardingCompleted: true },
    });

    await expect(page.getByText("Warning")).toBeVisible();
    await expect(page.getByText("Failed to load briefing").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});

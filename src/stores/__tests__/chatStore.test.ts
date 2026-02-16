import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "../chatStore";

vi.mock("@tauri-apps/api/core");

const mockInvoke = vi.mocked(invoke);

describe("chatStore", () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useChatStore.getState().reset();
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("has correct initial state", () => {
      const state = useChatStore.getState();
      expect(state.chats).toEqual([]);
      expect(state.selectedChatId).toBeNull();
      expect(state.messages).toEqual({});
      expect(state.isLoadingChats).toBe(false);
      expect(state.isLoadingMessages).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("loadChats", () => {
    it("loads chats with default limit", async () => {
      const mockChats = [
        { id: 1, title: "Chat 1" },
        { id: 2, title: "Chat 2" },
      ];
      mockInvoke.mockResolvedValueOnce(mockChats);

      await useChatStore.getState().loadChats();

      expect(mockInvoke).toHaveBeenCalledWith("get_chats", { limit: 100 });
      expect(useChatStore.getState().chats).toEqual(mockChats);
      expect(useChatStore.getState().isLoadingChats).toBe(false);
    });

    it("loads chats with custom limit", async () => {
      const mockChats = [{ id: 1, title: "Chat 1" }];
      mockInvoke.mockResolvedValueOnce(mockChats);

      await useChatStore.getState().loadChats(10);

      expect(mockInvoke).toHaveBeenCalledWith("get_chats", { limit: 10 });
      expect(useChatStore.getState().chats).toEqual(mockChats);
    });

    it("handles errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Failed to load"));

      await useChatStore.getState().loadChats();

      expect(useChatStore.getState().error).toBe("Error: Failed to load");
      expect(useChatStore.getState().isLoadingChats).toBe(false);
    });

    it("returns cache hit when currentChatLimit >= requested limit", async () => {
      const mockChats = [
        { id: 1, title: "Chat 1" },
        { id: 2, title: "Chat 2" },
      ];
      mockInvoke.mockResolvedValueOnce(mockChats);

      // First load with limit 100
      await useChatStore.getState().loadChats(100);
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Second load with limit 50 — should use cache (100 >= 50)
      const result = await useChatStore.getState().loadChats(50);
      expect(mockInvoke).toHaveBeenCalledTimes(1); // No additional call
      expect(result).toEqual(mockChats);
    });

    it("re-fetches when requested limit > currentChatLimit", async () => {
      const mockChats = [
        { id: 1, title: "Chat 1" },
        { id: 2, title: "Chat 2" },
      ];
      mockInvoke.mockResolvedValueOnce(mockChats);

      // First load with limit 50
      await useChatStore.getState().loadChats(50);
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(useChatStore.getState().currentChatLimit).toBe(50);

      // Second load with limit 150 — should re-fetch (50 < 150)
      const moreChats = [
        { id: 1, title: "Chat 1" },
        { id: 2, title: "Chat 2" },
        { id: 3, title: "Chat 3" },
      ];
      mockInvoke.mockResolvedValueOnce(moreChats);

      const result = await useChatStore.getState().loadChats(150);
      expect(mockInvoke).toHaveBeenCalledTimes(2);
      expect(mockInvoke).toHaveBeenLastCalledWith("get_chats", { limit: 150 });
      expect(result).toEqual(moreChats);
      expect(useChatStore.getState().currentChatLimit).toBe(150);
    });

    it("sets loading state during request", async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockInvoke.mockReturnValueOnce(promise);

      const loadPromise = useChatStore.getState().loadChats();
      expect(useChatStore.getState().isLoadingChats).toBe(true);

      resolvePromise!([]);
      await loadPromise;

      expect(useChatStore.getState().isLoadingChats).toBe(false);
    });
  });

  describe("selectChat", () => {
    it("selects a chat and loads messages if not cached", async () => {
      const mockMessages = [{ id: 1, text: "Hello", chatId: 123 }];
      mockInvoke.mockResolvedValueOnce(mockMessages);

      useChatStore.getState().selectChat(123);

      expect(useChatStore.getState().selectedChatId).toBe(123);
      // Wait for messages to load
      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("get_chat_messages", {
          chatId: 123,
          limit: 50,
          fromMessageId: undefined,
        });
      });
    });

    it("selects a chat without loading if messages are cached", () => {
      useChatStore.setState({
        messages: { 123: [{ id: 1, chatId: 123 } as any] },
      });

      useChatStore.getState().selectChat(123);

      expect(useChatStore.getState().selectedChatId).toBe(123);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("deselects chat when passed null", () => {
      useChatStore.setState({ selectedChatId: 123 });

      useChatStore.getState().selectChat(null);

      expect(useChatStore.getState().selectedChatId).toBeNull();
    });
  });

  describe("loadMessages", () => {
    it("loads messages for a chat", async () => {
      const mockMessages = [
        { id: 1, text: "Hello", chatId: 123 },
        { id: 2, text: "World", chatId: 123 },
      ];
      mockInvoke.mockResolvedValueOnce(mockMessages);

      await useChatStore.getState().loadMessages(123);

      expect(mockInvoke).toHaveBeenCalledWith("get_chat_messages", {
        chatId: 123,
        limit: 50,
        fromMessageId: undefined,
      });
      expect(useChatStore.getState().messages[123]).toEqual(mockMessages);
    });

    it("loads more messages with pagination", async () => {
      useChatStore.setState({
        messages: { 123: [{ id: 10, chatId: 123 } as any] },
      });
      const moreMessages = [
        { id: 5, chatId: 123 },
        { id: 4, chatId: 123 },
      ];
      mockInvoke.mockResolvedValueOnce(moreMessages);

      await useChatStore.getState().loadMessages(123, 50, 10);

      expect(mockInvoke).toHaveBeenCalledWith("get_chat_messages", {
        chatId: 123,
        limit: 50,
        fromMessageId: 10,
      });
      const messages = useChatStore.getState().messages[123];
      expect(messages).toHaveLength(3);
      // Messages should be sorted by ID in chronological order (oldest first)
      expect(messages[0].id).toBe(4);
      expect(messages[1].id).toBe(5);
      expect(messages[2].id).toBe(10);
    });

    it("replaces messages when force refreshing", async () => {
      useChatStore.setState({
        messages: { 123: [{ id: 10, chatId: 123 } as any] },
        messagesLoadedAt: { 123: Date.now() },
      });
      const newMessages = [{ id: 20, chatId: 123 }];
      mockInvoke.mockResolvedValueOnce(newMessages);

      // Use forceRefresh to bypass cache
      await useChatStore.getState().loadMessages(123, 50, undefined, true);

      expect(useChatStore.getState().messages[123]).toEqual(newMessages);
    });

    it("handles errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Load failed"));

      // No cached messages, so this will make the API call
      await useChatStore.getState().loadMessages(123, 50, undefined, true);

      expect(useChatStore.getState().error).toBe("Error: Load failed");
    });
  });

  describe("sendMessage", () => {
    it("sends a message", async () => {
      mockInvoke.mockResolvedValueOnce({ id: 1, text: "Hello", chatId: 123 });

      await useChatStore.getState().sendMessage(123, "Hello");

      expect(mockInvoke).toHaveBeenCalledWith("send_message", {
        chatId: 123,
        text: "Hello",
      });
    });

    it("handles send errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Send failed"));

      await useChatStore.getState().sendMessage(123, "Hello");

      expect(useChatStore.getState().error).toBe("Error: Send failed");
    });
  });

  describe("addMessage", () => {
    it("adds a message to existing chat", () => {
      useChatStore.setState({
        messages: { 123: [{ id: 1, chatId: 123 } as any] },
      });
      const newMessage = { id: 2, chatId: 123 } as any;

      useChatStore.getState().addMessage(newMessage);

      const messages = useChatStore.getState().messages[123];
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual(newMessage); // Prepended
    });

    it("creates message array for new chat", () => {
      const message = { id: 1, chatId: 456 } as any;

      useChatStore.getState().addMessage(message);

      expect(useChatStore.getState().messages[456]).toEqual([message]);
    });
  });

  describe("updateChat", () => {
    it("updates an existing chat", () => {
      useChatStore.setState({
        chats: [
          { id: 123, title: "Old Title", type: "private" } as any,
          { id: 456, title: "Other Chat", type: "group" } as any,
        ],
      });

      const updatedChat = { id: 123, title: "New Title", type: "private" } as any;
      useChatStore.getState().updateChat(updatedChat);

      const chats = useChatStore.getState().chats;
      expect(chats).toHaveLength(2);
      expect(chats.find((c) => c.id === 123)?.title).toBe("New Title");
      expect(chats.find((c) => c.id === 456)?.title).toBe("Other Chat");
    });

    it("does not modify chats if id not found", () => {
      useChatStore.setState({
        chats: [{ id: 123, title: "Chat", type: "private" } as any],
      });

      const unknownChat = { id: 999, title: "Unknown", type: "group" } as any;
      useChatStore.getState().updateChat(unknownChat);

      const chats = useChatStore.getState().chats;
      expect(chats).toHaveLength(1);
      expect(chats[0].id).toBe(123);
    });
  });

  describe("clearError", () => {
    it("clears the error", () => {
      useChatStore.setState({ error: "Some error" });
      useChatStore.getState().clearError();
      expect(useChatStore.getState().error).toBeNull();
    });
  });
});

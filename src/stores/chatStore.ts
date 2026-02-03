import { create } from "zustand";
import type { Chat, Message } from "@/types/telegram";
import * as tauri from "@/lib/tauri";
import { type ChatFilters } from "@/lib/tauri";

interface ChatStore {
  chats: Chat[];
  selectedChatId: number | null;
  messages: Record<number, Message[]>;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  error: string | null;

  // Actions
  loadChats: (limit?: number, filters?: ChatFilters) => Promise<void>;
  selectChat: (chatId: number | null) => void;
  loadMessages: (chatId: number, limit?: number, fromMessageId?: number) => Promise<void>;
  sendMessage: (chatId: number, text: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateChat: (chat: Chat) => void;
  clearError: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  selectedChatId: null,
  messages: {},
  isLoadingChats: false,
  isLoadingMessages: false,
  error: null,

  loadChats: async (limit = 50, filters?: ChatFilters) => {
    // Clear existing chats to prevent showing stale data during load
    set({ isLoadingChats: true, error: null, chats: [] });
    try {
      const chats = (await tauri.getChats(limit, filters)) as Chat[];
      set({ chats });
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoadingChats: false });
    }
  },

  selectChat: (chatId) => {
    set({ selectedChatId: chatId });
    if (chatId && !get().messages[chatId]) {
      get().loadMessages(chatId);
    }
  },

  loadMessages: async (chatId, limit = 50, fromMessageId) => {
    set({ isLoadingMessages: true, error: null });
    try {
      const newMessages = (await tauri.getChatMessages(
        chatId,
        limit,
        fromMessageId
      )) as Message[];

      set((state) => {
        const existing = state.messages[chatId] || [];
        let combined: Message[];
        if (fromMessageId) {
          // Pagination: merge and sort by message ID to maintain chronological order
          const allMessages = [...existing, ...newMessages];
          // Deduplicate by ID and sort ascending (oldest first)
          const uniqueById = new Map(allMessages.map((m) => [m.id, m]));
          combined = Array.from(uniqueById.values()).sort((a, b) => a.id - b.id);
        } else {
          combined = newMessages;
        }
        return {
          messages: {
            ...state.messages,
            [chatId]: combined,
          },
        };
      });
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (chatId, text) => {
    try {
      await tauri.sendMessage(chatId, text);
    } catch (error) {
      set({ error: String(error) });
    }
  },

  addMessage: (message) => {
    set((state) => {
      const existing = state.messages[message.chatId] || [];
      return {
        messages: {
          ...state.messages,
          [message.chatId]: [message, ...existing],
        },
      };
    });
  },

  updateChat: (chat) => {
    set((state) => ({
      chats: state.chats.map((c) => (c.id === chat.id ? chat : c)),
    }));
  },

  clearError: () => set({ error: null }),
}));

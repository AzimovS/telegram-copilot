import { create } from "zustand";
import type { Chat, Message } from "@/types/telegram";
import * as tauri from "@/lib/tauri";
import { type ChatFilters, type BatchMessageResult } from "@/lib/tauri";

interface ChatStore {
  chats: Chat[];
  selectedChatId: number | null;
  messages: Record<number, Message[]>;
  messagesLoadedAt: Record<number, number>; // Track when messages were loaded for each chat
  isLoadingChats: boolean;
  isLoadingMoreChats: boolean;
  isLoadingMessages: boolean;
  error: string | null;
  lastChatsLoadedAt: number | null;
  lastFiltersHash: string | null;
  currentChatLimit: number;
  hasMoreChats: boolean;

  // Actions
  loadChats: (limit?: number, filters?: ChatFilters, forceRefresh?: boolean) => Promise<Chat[]>;
  loadMoreChats: (filters?: ChatFilters) => Promise<Chat[]>;
  selectChat: (chatId: number | null) => void;
  loadMessages: (chatId: number, limit?: number, fromMessageId?: number, forceRefresh?: boolean) => Promise<Message[]>;
  batchLoadMessages: (chatIds: { chatId: number; limit: number }[]) => Promise<Record<number, Message[]>>;
  setCachedMessages: (results: BatchMessageResult[]) => void;
  sendMessage: (chatId: number, text: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateChat: (chat: Chat) => void;
  clearError: () => void;
  reset: () => void;
  backgroundPrefetch: (filters?: ChatFilters) => Promise<void>;

  // Helpers
  shouldRefreshChats: (ttlMinutes: number, currentFiltersHash: string) => boolean;
  shouldRefreshMessages: (chatId: number, ttlMinutes: number) => boolean;
  getCachedMessages: (chatId: number) => Message[] | null;
}

// Generate a simple hash from filters for comparison
function hashFilters(filters?: ChatFilters): string {
  if (!filters) return "default";
  return JSON.stringify(filters);
}

const CHAT_PAGE_SIZE = 50;
export const DEFAULT_CHAT_LIMIT = 100;

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  selectedChatId: null,
  messages: {},
  messagesLoadedAt: {},
  isLoadingChats: false,
  isLoadingMoreChats: false,
  isLoadingMessages: false,
  error: null,
  lastChatsLoadedAt: null,
  lastFiltersHash: null,
  currentChatLimit: 0,
  hasMoreChats: true,

  loadChats: async (limit = DEFAULT_CHAT_LIMIT, filters?: ChatFilters, forceRefresh = false) => {
    const filtersHash = hashFilters(filters);
    const { chats, lastFiltersHash, currentChatLimit } = get();

    // Return cached chats if available, same filters, and we have enough chats
    if (!forceRefresh && chats.length > 0 && lastFiltersHash === filtersHash && currentChatLimit >= limit) {
      return chats;
    }

    // Only show loading spinner if we have no cached chats to display
    // This prevents flashing on background refreshes
    const showLoading = chats.length === 0;
    if (showLoading) {
      set({ isLoadingChats: true, error: null });
    } else {
      set({ error: null });
    }

    try {
      const fetchLimit = Math.max(limit, currentChatLimit);
      const newChats = (await tauri.getChats(fetchLimit, filters)) as Chat[];
      set({
        chats: newChats,
        lastChatsLoadedAt: Date.now(),
        lastFiltersHash: filtersHash,
        currentChatLimit: fetchLimit,
        hasMoreChats: newChats.length >= fetchLimit, // If we got fewer than requested, no more chats
      });
      return newChats;
    } catch (error) {
      set({ error: String(error) });
      return get().chats; // Return existing chats on error
    } finally {
      if (showLoading) {
        set({ isLoadingChats: false });
      }
    }
  },

  loadMoreChats: async (filters?: ChatFilters) => {
    const { currentChatLimit, isLoadingMoreChats, hasMoreChats } = get();

    if (isLoadingMoreChats || !hasMoreChats) {
      return get().chats;
    }

    set({ isLoadingMoreChats: true, error: null });

    try {
      const newLimit = currentChatLimit + CHAT_PAGE_SIZE;
      const newChats = (await tauri.getChats(newLimit, filters)) as Chat[];
      const gotMoreChats = newChats.length > currentChatLimit;

      set({
        chats: newChats,
        lastChatsLoadedAt: Date.now(),
        lastFiltersHash: hashFilters(filters),
        currentChatLimit: newLimit,
        hasMoreChats: gotMoreChats && newChats.length >= newLimit,
      });
      return newChats;
    } catch (error) {
      set({ error: String(error) });
      return get().chats;
    } finally {
      set({ isLoadingMoreChats: false });
    }
  },

  selectChat: (chatId) => {
    set({ selectedChatId: chatId });
    if (chatId && !get().messages[chatId]) {
      get().loadMessages(chatId);
    }
  },

  loadMessages: async (chatId, limit = 50, fromMessageId, forceRefresh = false) => {
    const { messages } = get();
    const cached = messages[chatId];

    // Return cached messages if available and not forcing refresh (and not paginating)
    if (!forceRefresh && !fromMessageId && cached && cached.length > 0) {
      return cached;
    }

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
          messagesLoadedAt: {
            ...state.messagesLoadedAt,
            [chatId]: Date.now(),
          },
        };
      });
      return get().messages[chatId] || [];
    } catch (error) {
      set({ error: String(error) });
      return cached || [];
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  setCachedMessages: (results: BatchMessageResult[]) => {
    set((state) => {
      const newMessages = { ...state.messages };
      const newLoadedAt = { ...state.messagesLoadedAt };
      const now = Date.now();
      for (const result of results) {
        if (!result.error && result.messages.length > 0) {
          // Only update if we don't already have newer data
          const existingLoadedAt = state.messagesLoadedAt[result.chatId] || 0;
          if (now > existingLoadedAt) {
            newMessages[result.chatId] = result.messages;
            newLoadedAt[result.chatId] = now;
          }
        }
      }
      return { messages: newMessages, messagesLoadedAt: newLoadedAt };
    });
  },

  batchLoadMessages: async (chatIds) => {
    const state = get();
    // Filter out chats that already have fresh cached messages (2 min TTL)
    const uncached = chatIds.filter(({ chatId }) => state.shouldRefreshMessages(chatId, 2));
    const result: Record<number, Message[]> = {};

    // Use cached data for fresh entries
    for (const { chatId } of chatIds) {
      if (!state.shouldRefreshMessages(chatId, 2)) {
        result[chatId] = state.messages[chatId] || [];
      }
    }

    // Batch-fetch uncached entries
    if (uncached.length > 0) {
      const batchResults = await tauri.getBatchMessages(uncached);
      get().setCachedMessages(batchResults);
      for (const r of batchResults) {
        result[r.chatId] = r.error ? [] : r.messages;
      }
    }

    return result;
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

  reset: () =>
    set({
      chats: [],
      selectedChatId: null,
      messages: {},
      messagesLoadedAt: {},
      isLoadingChats: false,
      isLoadingMoreChats: false,
      isLoadingMessages: false,
      error: null,
      lastChatsLoadedAt: null,
      lastFiltersHash: null,
      currentChatLimit: 0,
      hasMoreChats: true,
    }),

  shouldRefreshChats: (ttlMinutes, currentFiltersHash) => {
    const { chats, lastChatsLoadedAt, lastFiltersHash } = get();
    if (!chats.length || !lastChatsLoadedAt) return true;
    if (lastFiltersHash !== currentFiltersHash) return true;
    const ageMs = Date.now() - lastChatsLoadedAt;
    const ttlMs = ttlMinutes * 60 * 1000;
    return ageMs >= ttlMs;
  },

  shouldRefreshMessages: (chatId, ttlMinutes) => {
    const { messages, messagesLoadedAt } = get();
    const cached = messages[chatId];
    const loadedAt = messagesLoadedAt[chatId];
    if (!cached || !cached.length || !loadedAt) return true;
    const ageMs = Date.now() - loadedAt;
    const ttlMs = ttlMinutes * 60 * 1000;
    return ageMs >= ttlMs;
  },

  getCachedMessages: (chatId) => {
    return get().messages[chatId] || null;
  },

  backgroundPrefetch: async (filters?: ChatFilters) => {
    try {
      const chats = await get().loadChats(DEFAULT_CHAT_LIMIT, filters);
      const uncached = chats.filter((c) => !get().messages[c.id]);
      if (uncached.length > 0) {
        const requests = uncached.map((c) => ({ chatId: c.id, limit: 30 }));
        const results = await tauri.getBatchMessages(requests);
        get().setCachedMessages(results);
      }
    } catch (e) {
      console.warn("Background prefetch failed (non-fatal):", e);
    }
  },
}));

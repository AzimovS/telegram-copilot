import { create } from "zustand";
import * as tauri from "@/lib/tauri";
import { chatFiltersFromSettings } from "@/lib/tauri";
import { useSettingsStore, getCacheTTL } from "@/stores/settingsStore";
import { useChatStore, DEFAULT_CHAT_LIMIT } from "@/stores/chatStore";
import type { Folder } from "@/types/telegram";
import {
  type ChatSummary,
  LARGE_GROUP_THRESHOLD,
  MESSAGES_PER_CHAT,
  timeFilters,
} from "@/components/summary/types";

function formatCacheAge(generatedAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diffSeconds = now - generatedAt;
  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}

interface SummaryStore {
  summaries: ChatSummary[];
  isLoading: boolean;
  error: string | null;
  lastLoadedAt: number | null;
  isCached: boolean;
  cacheAge: string | null;

  // Pagination state
  offset: number;
  hasMore: boolean;
  isLoadingMore: boolean;

  // Filter state (to detect when filters change)
  filterHash: string | null;

  // Actions
  setSummaries: (summaries: ChatSummary[], append?: boolean) => void;
  setLoading: (loading: boolean) => void;
  setLoadingMore: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCacheInfo: (cached: boolean, age: string | null) => void;
  setHasMore: (hasMore: boolean) => void;
  setOffset: (offset: number) => void;
  setFilterHash: (hash: string) => void;
  updateSummary: (chatId: number, summary: Partial<ChatSummary>) => void;
  clear: () => void;

  // Background prefetch
  backgroundPrefetchSummaries: () => Promise<void>;

  // Helpers
  shouldRefresh: (ttlMinutes: number, currentFilterHash: string) => boolean;
}

export const useSummaryStore = create<SummaryStore>((set, get) => ({
  summaries: [],
  isLoading: false,
  error: null,
  lastLoadedAt: null,
  isCached: false,
  cacheAge: null,
  offset: 0,
  hasMore: false,
  isLoadingMore: false,
  filterHash: null,

  setSummaries: (summaries, append = false) => {
    set((state) => ({
      summaries: append ? [...state.summaries, ...summaries] : summaries,
      lastLoadedAt: Date.now(),
      error: null,
    }));
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setLoadingMore: (loading) => set({ isLoadingMore: loading }),

  setError: (error) => set({ error }),

  setCacheInfo: (cached, age) => set({ isCached: cached, cacheAge: age }),

  setHasMore: (hasMore) => set({ hasMore }),

  setOffset: (offset) => set({ offset }),

  setFilterHash: (hash) => set({ filterHash: hash }),

  updateSummary: (chatId, updates) => {
    set((state) => ({
      summaries: state.summaries.map((s) =>
        s.chatId === chatId ? { ...s, ...updates } : s
      ),
    }));
  },

  clear: () =>
    set({
      summaries: [],
      lastLoadedAt: null,
      error: null,
      offset: 0,
      hasMore: false,
      isCached: false,
      cacheAge: null,
      filterHash: null,
    }),

  backgroundPrefetchSummaries: async () => {
    const { isLoading } = get();
    if (isLoading) return;

    // Default filter options matching the Summary tab's initial state
    const defaultOptions = {
      typeFilter: "all" as const,
      timeFilter: "week" as const,
      needsResponseOnly: false,
      sortBy: "recent" as const,
    };

    const globalChatFilters = useSettingsStore.getState().chatFilters;
    const cacheTTL = getCacheTTL();
    const filterHash =
      JSON.stringify(defaultOptions) + JSON.stringify(globalChatFilters);

    if (!get().shouldRefresh(cacheTTL.summaryTTLMinutes, filterHash)) return;

    set({ isLoading: true, error: null, offset: 0, filterHash });

    try {
      // Load folders if needed
      let folders: Folder[] = [];
      if (globalChatFilters.selectedFolderIds.length > 0) {
        try {
          folders = await tauri.getFolders();
        } catch {
          /* ignore */
        }
      }

      const filters = chatFiltersFromSettings(globalChatFilters, folders);
      const filtersHash = JSON.stringify(filters);

      const chatStore = useChatStore.getState();
      const shouldRefreshChats = chatStore.shouldRefreshChats(2, filtersHash);
      const chats = (await chatStore.loadChats(
        DEFAULT_CHAT_LIMIT,
        filters,
        shouldRefreshChats
      )) as { id: number; title: string; type: string; unreadCount: number; lastMessage?: { date: number }; memberCount?: number }[];

      // Filter by time (7-day cutoff for "week")
      const timeConfig = timeFilters.find((t) => t.value === "week");
      const cutoffDate =
        Math.floor(Date.now() / 1000) - (timeConfig?.days || 7) * 24 * 60 * 60;
      const filteredChats = chats.filter(
        (c) => c.lastMessage?.date && c.lastMessage.date > cutoffDate
      );

      // First page only
      const pageSize = 10;
      const paginatedChats = filteredChats.slice(0, pageSize);
      set({ hasMore: pageSize < filteredChats.length });

      if (paginatedChats.length === 0) {
        get().setSummaries([]);
        set({ isLoading: false });
        return;
      }

      // Separate large groups
      const largeGroupSummaries: ChatSummary[] = [];
      const smallChats = paginatedChats.filter((chat) => {
        const memberCount = chat.memberCount || 0;
        const isLargeGroup =
          chat.type === "group" && memberCount >= LARGE_GROUP_THRESHOLD;
        if (isLargeGroup) {
          largeGroupSummaries.push({
            chatId: chat.id,
            chatTitle: chat.title,
            chatType: chat.type,
            summary: `Large group with 0 messages in this period. Too many members for detailed AI analysis.`,
            keyPoints: [
              `${memberCount}+ members`,
              `0 recent messages`,
            ],
            actionItems: [],
            sentiment: "neutral",
            needsResponse: false,
            messageCount: 0,
            lastMessageDate:
              chat.lastMessage?.date || Math.floor(Date.now() / 1000),
            isLargeGroup: true,
            memberCount,
          });
          return false;
        }
        return true;
      });

      // Batch-fetch messages
      const batchRequests = smallChats.map((chat) => ({
        chatId: chat.id,
        limit: MESSAGES_PER_CHAT,
      }));
      const messagesByChat = await chatStore.batchLoadMessages(batchRequests);

      // Build chat contexts
      const chatContexts = smallChats
        .filter((chat) => (messagesByChat[chat.id]?.length ?? 0) > 0)
        .map((chat) => {
          const messages = messagesByChat[chat.id];
          return {
            chat_id: chat.id,
            chat_title: chat.title,
            chat_type: chat.type,
            unread_count: chat.unreadCount,
            messages: messages.map((m: any) => ({
              id: Number(m.id),
              sender_name: m.senderName,
              text: m.content.type === "text" ? m.content.text : "[Media]",
              date: m.date,
              is_outgoing: m.isOutgoing,
            })),
          };
        });

      if (chatContexts.length === 0 && largeGroupSummaries.length > 0) {
        const sorted = [...largeGroupSummaries].sort(
          (a, b) => b.lastMessageDate - a.lastMessageDate
        );
        get().setSummaries(sorted);
        set({ isLoading: false, offset: pageSize });
        get().setCacheInfo(false, null);
        return;
      }

      if (chatContexts.length === 0) {
        get().setSummaries([]);
        set({ isLoading: false });
        return;
      }

      const data = await tauri.generateBatchSummaries(
        chatContexts,
        false,
        cacheTTL.summaryTTLMinutes
      );

      let newSummaries: ChatSummary[] = data.summaries
        .filter((s: any) => s && typeof s === "object" && s.chat_id != null)
        .map((s: any) => ({
          chatId: s.chat_id,
          chatTitle: s.chat_title ?? "Unknown Chat",
          chatType: s.chat_type ?? "unknown",
          summary: s.summary ?? "No summary available",
          keyPoints: Array.isArray(s.key_points) ? s.key_points : [],
          actionItems: Array.isArray(s.action_items) ? s.action_items : [],
          sentiment: (s.sentiment ?? "neutral") as
            | "positive"
            | "neutral"
            | "negative",
          needsResponse: Boolean(s.needs_response),
          messageCount:
            typeof s.message_count === "number" ? s.message_count : 0,
          lastMessageDate:
            typeof s.last_message_date === "number" ? s.last_message_date : 0,
        }));

      newSummaries = [...newSummaries, ...largeGroupSummaries];
      newSummaries.sort((a, b) => b.lastMessageDate - a.lastMessageDate);

      get().setSummaries(newSummaries);
      set({ offset: pageSize });
      get().setCacheInfo(
        data.cached,
        data.cached && data.generated_at
          ? formatCacheAge(data.generated_at)
          : null
      );
    } catch (err) {
      console.error("Background summary prefetch failed:", err);
      set({
        error:
          err instanceof Error
            ? err.message
            : "Failed to connect to AI backend.",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  shouldRefresh: (ttlMinutes, currentFilterHash) => {
    const { lastLoadedAt, summaries, filterHash } = get();
    // Refresh if no data, filters changed, or TTL expired
    if (!summaries.length || !lastLoadedAt) return true;
    if (filterHash !== currentFilterHash) return true;
    const ageMs = Date.now() - lastLoadedAt;
    const ttlMs = ttlMinutes * 60 * 1000;
    return ageMs >= ttlMs;
  },
}));

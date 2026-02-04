import { useState, useCallback, useEffect, useRef } from "react";
import * as tauri from "@/lib/tauri";
import { chatFiltersFromSettings } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSummaryStore } from "@/stores/summaryStore";
import { useChatStore } from "@/stores/chatStore";
import type { Folder } from "@/types/telegram";
import {
  ChatSummary,
  ChatTypeFilter,
  TimeFilter,
  SortOption,
  timeFilters,
  LARGE_GROUP_THRESHOLD,
  MESSAGES_PER_CHAT,
} from "./types";

interface Chat {
  id: number;
  title: string;
  type: string;
  unreadCount: number;
  lastMessage?: { date: number };
  memberCount?: number;
}

interface UseSummariesOptions {
  typeFilter: ChatTypeFilter;
  timeFilter: TimeFilter;
  needsResponseOnly: boolean;
  sortBy: SortOption;
}

// Generate a hash from filter options for cache invalidation
function hashFilterOptions(options: UseSummariesOptions): string {
  return JSON.stringify(options);
}

export function useSummaries(options: UseSummariesOptions) {
  const { typeFilter, timeFilter, needsResponseOnly, sortBy } = options;

  const globalChatFilters = useSettingsStore((state) => state.chatFilters);
  const cacheTTL = useSettingsStore((state) => state.cacheTTL);
  const summaryStore = useSummaryStore();
  const chatStore = useChatStore();

  const [regeneratingChatId, setRegeneratingChatId] = useState<number | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const isLoadingRef = useRef(false);

  const {
    summaries,
    isLoading,
    error,
    isCached,
    cacheAge,
    offset,
    hasMore,
    isLoadingMore,
  } = summaryStore;

  const pageSize = 10;

  // Load folders when selectedFolderIds changes
  useEffect(() => {
    if (globalChatFilters.selectedFolderIds.length > 0) {
      tauri.getFolders()
        .then(setFolders)
        .catch((err) => console.error("Failed to load folders:", err));
    } else {
      setFolders([]);
    }
  }, [globalChatFilters.selectedFolderIds]);

  const formatCacheAge = (generatedAt: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const diffSeconds = now - generatedAt;
    if (diffSeconds < 60) return "just now";
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return `${Math.floor(diffSeconds / 86400)}d ago`;
  };

  const sortSummaries = useCallback(
    (items: ChatSummary[]): ChatSummary[] => {
      const sorted = [...items];
      switch (sortBy) {
        case "recent":
          return sorted.sort((a, b) => b.lastMessageDate - a.lastMessageDate);
        case "needs_response":
          return sorted.sort((a, b) => {
            if (a.needsResponse === b.needsResponse) {
              return b.lastMessageDate - a.lastMessageDate;
            }
            return a.needsResponse ? -1 : 1;
          });
        case "sentiment":
          const sentimentOrder = { negative: 0, neutral: 1, positive: 2 };
          return sorted.sort((a, b) => {
            const orderA = sentimentOrder[a.sentiment] ?? 1;
            const orderB = sentimentOrder[b.sentiment] ?? 1;
            if (orderA === orderB) {
              return b.lastMessageDate - a.lastMessageDate;
            }
            return orderA - orderB;
          });
        case "messages":
          return sorted.sort((a, b) => b.messageCount - a.messageCount);
        default:
          return sorted;
      }
    },
    [sortBy]
  );

  const createLargeGroupSummary = (
    chat: { id: number; title: string; type: string; memberCount?: number },
    messageCount: number,
    lastMessageDate: number
  ): ChatSummary => ({
    chatId: chat.id,
    chatTitle: chat.title,
    chatType: chat.type,
    summary: `Large group with ${messageCount} messages in this period. Too many members for detailed AI analysis.`,
    keyPoints: [
      `${chat.memberCount || 500}+ members`,
      `${messageCount} recent messages`,
    ],
    actionItems: [],
    sentiment: "neutral",
    needsResponse: false,
    messageCount,
    lastMessageDate,
    isLargeGroup: true,
    memberCount: chat.memberCount,
  });

  const loadSummaries = useCallback(
    async (regenerate = false, append = false) => {
      // Prevent concurrent loads
      if (isLoadingRef.current && !append) {
        return;
      }

      const currentFilterHash = hashFilterOptions(options) + JSON.stringify(globalChatFilters);

      // Check if we should skip loading (use cached data)
      if (!regenerate && !append && !summaryStore.shouldRefresh(cacheTTL.summaryTTLMinutes, currentFilterHash)) {
        return;
      }

      isLoadingRef.current = true;

      if (append) {
        summaryStore.setLoadingMore(true);
      } else {
        summaryStore.setLoading(true);
        summaryStore.setOffset(0);
        summaryStore.setFilterHash(currentFilterHash);
      }
      summaryStore.setError(null);

      try {
        const filters = chatFiltersFromSettings(globalChatFilters, folders);
        const filtersHash = JSON.stringify(filters);

        // Use cached chats if available (2 min TTL for chat list)
        const shouldRefreshChats = chatStore.shouldRefreshChats(2, filtersHash);
        const chats = await chatStore.loadChats(100, filters, regenerate || shouldRefreshChats) as Chat[];

        let filteredChats = chats;
        if (typeFilter !== "all") {
          filteredChats = filteredChats.filter((c) => c.type === typeFilter);
        }

        const timeConfig = timeFilters.find((t) => t.value === timeFilter);
        const cutoffDate =
          Math.floor(Date.now() / 1000) - (timeConfig?.days || 7) * 24 * 60 * 60;
        filteredChats = filteredChats.filter(
          (c) => c.lastMessage?.date && c.lastMessage.date > cutoffDate
        );

        const currentOffset = append ? offset : 0;
        const paginatedChats = filteredChats.slice(
          currentOffset,
          currentOffset + pageSize
        );
        summaryStore.setHasMore(currentOffset + pageSize < filteredChats.length);

        if (paginatedChats.length === 0) {
          if (!append) summaryStore.setSummaries([]);
          summaryStore.setLoading(false);
          summaryStore.setLoadingMore(false);
          isLoadingRef.current = false;
          return;
        }

        const chatContexts = [];
        const largeGroupSummaries: ChatSummary[] = [];

        for (let i = 0; i < paginatedChats.length; i++) {
          const chat = paginatedChats[i];
          try {
            // Use cached messages if available (2 min TTL for messages)
            const shouldRefreshMsgs = chatStore.shouldRefreshMessages(chat.id, 2);
            const messages = await chatStore.loadMessages(chat.id, MESSAGES_PER_CHAT, undefined, regenerate || shouldRefreshMsgs);
            const memberCount = chat.memberCount || 0;
            const isLargeGroup =
              chat.type === "group" && memberCount >= LARGE_GROUP_THRESHOLD;

            if (isLargeGroup) {
              const lastMsgDate = messages[0]?.date || Math.floor(Date.now() / 1000);
              largeGroupSummaries.push(
                createLargeGroupSummary(
                  { id: chat.id, title: chat.title, type: chat.type, memberCount },
                  messages.length,
                  lastMsgDate
                )
              );
            } else {
              chatContexts.push({
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
              });
            }

            // Small delay between requests only if fetching fresh
            if ((regenerate || shouldRefreshMsgs) && i < paginatedChats.length - 1) {
              await new Promise((r) => setTimeout(r, 50));
            }
          } catch (e) {
            console.warn(`Failed to get messages for chat ${chat.id}:`, e);
          }
        }

        if (chatContexts.length === 0 && largeGroupSummaries.length > 0) {
          let newSummaries = sortSummaries(largeGroupSummaries);
          if (needsResponseOnly) {
            newSummaries = newSummaries.filter((s) => s.needsResponse);
          }
          summaryStore.setSummaries(newSummaries, append);
          summaryStore.setOffset(currentOffset + pageSize);
          summaryStore.setCacheInfo(false, null);
          summaryStore.setLoading(false);
          summaryStore.setLoadingMore(false);
          isLoadingRef.current = false;
          return;
        }

        if (chatContexts.length === 0) {
          if (!append) summaryStore.setSummaries([]);
          summaryStore.setLoading(false);
          summaryStore.setLoadingMore(false);
          isLoadingRef.current = false;
          return;
        }

        const data = await tauri.generateBatchSummaries(
          chatContexts,
          regenerate,
          cacheTTL.summaryTTLMinutes
        );

        let newSummaries: ChatSummary[] = data.summaries
          .filter((s) => s && typeof s === "object" && s.chat_id != null)
          .map((s) => ({
            chatId: s.chat_id,
            chatTitle: s.chat_title ?? "Unknown Chat",
            chatType: s.chat_type ?? "unknown",
            summary: s.summary ?? "No summary available",
            keyPoints: Array.isArray(s.key_points) ? s.key_points : [],
            actionItems: Array.isArray(s.action_items) ? s.action_items : [],
            sentiment: (s.sentiment ?? "neutral") as "positive" | "neutral" | "negative",
            needsResponse: Boolean(s.needs_response),
            messageCount: typeof s.message_count === "number" ? s.message_count : 0,
            lastMessageDate: typeof s.last_message_date === "number" ? s.last_message_date : 0,
          }));

        newSummaries = [...newSummaries, ...largeGroupSummaries];

        if (needsResponseOnly) {
          newSummaries = newSummaries.filter((s) => s.needsResponse);
        }

        newSummaries = sortSummaries(newSummaries);

        summaryStore.setSummaries(newSummaries, append);
        summaryStore.setOffset(currentOffset + pageSize);

        summaryStore.setCacheInfo(data.cached, data.cached && data.generated_at ? formatCacheAge(data.generated_at) : null);
      } catch (err) {
        console.error("Failed to load summaries:", err);
        summaryStore.setError(
          err instanceof Error ? err.message : "Failed to connect to AI backend."
        );
      } finally {
        summaryStore.setLoading(false);
        summaryStore.setLoadingMore(false);
        isLoadingRef.current = false;
      }
    },
    [typeFilter, timeFilter, needsResponseOnly, offset, sortSummaries, globalChatFilters, folders, cacheTTL, summaryStore, chatStore, options]
  );

  const regenerateSingle = useCallback(
    async (chatId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      setRegeneratingChatId(chatId);

      try {
        const existingSummary = summaries.find((s) => s.chatId === chatId);
        if (!existingSummary || existingSummary.isLargeGroup) return;

        const messages = await chatStore.loadMessages(chatId, MESSAGES_PER_CHAT, undefined, true);

        const data = await tauri.generateBatchSummaries(
          [
            {
              chat_id: chatId,
              chat_title: existingSummary.chatTitle,
              chat_type: existingSummary.chatType,
              unread_count: 0,
              messages: messages.map((m: any) => ({
                id: Number(m.id),
                sender_name: m.senderName,
                text: m.content.type === "text" ? m.content.text : "[Media]",
                date: m.date,
                is_outgoing: m.isOutgoing,
              })),
            },
          ],
          true,
          cacheTTL.summaryTTLMinutes
        );

        if (data && Array.isArray(data.summaries) && data.summaries.length > 0) {
          const newSummary = data.summaries[0];
          if (newSummary && typeof newSummary === "object" && newSummary.chat_id != null) {
            summaryStore.updateSummary(chatId, {
              chatTitle: newSummary.chat_title ?? existingSummary.chatTitle,
              chatType: newSummary.chat_type ?? existingSummary.chatType,
              summary: newSummary.summary ?? "No summary available",
              keyPoints: Array.isArray(newSummary.key_points) ? newSummary.key_points : [],
              actionItems: Array.isArray(newSummary.action_items) ? newSummary.action_items : [],
              sentiment: (newSummary.sentiment ?? "neutral") as "positive" | "neutral" | "negative",
              needsResponse: Boolean(newSummary.needs_response),
              messageCount: typeof newSummary.message_count === "number" ? newSummary.message_count : existingSummary.messageCount,
              lastMessageDate: typeof newSummary.last_message_date === "number" ? newSummary.last_message_date : existingSummary.lastMessageDate,
            });
          }
        }
      } catch (err) {
        console.error("Failed to regenerate summary:", err);
      } finally {
        setRegeneratingChatId(null);
      }
    },
    [summaries, cacheTTL.summaryTTLMinutes, summaryStore, chatStore]
  );

  // Re-sort when sortBy changes
  useEffect(() => {
    if (summaries.length > 0) {
      summaryStore.setSummaries(sortSummaries(summaries));
    }
  }, [sortBy]);

  // Initial load and filter changes
  useEffect(() => {
    const currentFilterHash = hashFilterOptions(options) + JSON.stringify(globalChatFilters);
    if (summaryStore.shouldRefresh(cacheTTL.summaryTTLMinutes, currentFilterHash)) {
      loadSummaries();
    }
  }, [typeFilter, timeFilter, needsResponseOnly, globalChatFilters, folders, cacheTTL.summaryTTLMinutes]);

  return {
    summaries,
    isLoading,
    error,
    lastUpdated: summaryStore.lastLoadedAt ? new Date(summaryStore.lastLoadedAt) : null,
    isCached,
    cacheAge,
    regeneratingChatId,
    hasMore,
    isLoadingMore,
    loadSummaries,
    regenerateSingle,
    loadMore: () => loadSummaries(false, true),
  };
}

import { useState, useCallback, useEffect } from "react";
import * as tauri from "@/lib/tauri";
import { chatFiltersFromSettings } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Folder } from "@/types/telegram";
import {
  ChatSummary,
  ChatTypeFilter,
  TimeFilter,
  SortOption,
  timeFilters,
  LARGE_GROUP_THRESHOLD,
  MESSAGES_PER_CHAT,
  API_URL,
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

export function useSummaries(options: UseSummariesOptions) {
  const { typeFilter, timeFilter, needsResponseOnly, sortBy } = options;

  const globalChatFilters = useSettingsStore((state) => state.chatFilters);
  const [summaries, setSummaries] = useState<ChatSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState<string | null>(null);
  const [regeneratingChatId, setRegeneratingChatId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);

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
  }, [globalChatFilters.selectedFolderIds.length]);

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
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setOffset(0);
        setSummaries([]);
      }
      setError(null);

      try {
        const filters = chatFiltersFromSettings(globalChatFilters, folders);
        const chats = (await tauri.getChats(100, filters)) as Chat[];

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
        setHasMore(currentOffset + pageSize < filteredChats.length);

        if (paginatedChats.length === 0) {
          if (!append) setSummaries([]);
          setLastUpdated(new Date());
          return;
        }

        const chatContexts = [];
        const largeGroupSummaries: ChatSummary[] = [];

        for (let i = 0; i < paginatedChats.length; i++) {
          const chat = paginatedChats[i];
          try {
            const messages = await tauri.getChatMessages(chat.id, MESSAGES_PER_CHAT);
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

            if (i < paginatedChats.length - 1) {
              await new Promise((r) => setTimeout(r, 100));
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
          if (append) {
            setSummaries((prev) => sortSummaries([...prev, ...newSummaries]));
            setOffset(currentOffset + pageSize);
          } else {
            setSummaries(newSummaries);
            setOffset(pageSize);
          }
          setLastUpdated(new Date());
          setCacheAge(null);
          setIsCached(false);
          return;
        }

        if (chatContexts.length === 0) {
          if (!append) setSummaries([]);
          setLastUpdated(new Date());
          return;
        }

        const response = await fetch(`${API_URL}/api/summary/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chats: chatContexts, regenerate }),
        });

        if (!response.ok) throw new Error(`Backend error: ${response.status}`);

        const data = await response.json();

        // Validate response structure
        if (!data || typeof data !== "object") {
          throw new Error("Invalid response from backend: expected object");
        }
        if (!Array.isArray(data.summaries)) {
          throw new Error("Invalid response from backend: missing summaries array");
        }

        let newSummaries: ChatSummary[] = data.summaries
          .filter((s: any) => s && typeof s === "object" && s.chat_id != null)
          .map((s: any) => ({
            chatId: s.chat_id,
            chatTitle: s.chat_title ?? "Unknown Chat",
            chatType: s.chat_type ?? "unknown",
            summary: s.summary ?? "No summary available",
            keyPoints: Array.isArray(s.key_points) ? s.key_points : [],
            actionItems: Array.isArray(s.action_items) ? s.action_items : [],
            sentiment: s.sentiment ?? "neutral",
            needsResponse: Boolean(s.needs_response),
            messageCount: typeof s.message_count === "number" ? s.message_count : 0,
            lastMessageDate: typeof s.last_message_date === "number" ? s.last_message_date : 0,
          }));

        newSummaries = [...newSummaries, ...largeGroupSummaries];

        if (needsResponseOnly) {
          newSummaries = newSummaries.filter((s) => s.needsResponse);
        }

        newSummaries = sortSummaries(newSummaries);

        if (append) {
          setSummaries((prev) => sortSummaries([...prev, ...newSummaries]));
          setOffset(currentOffset + pageSize);
        } else {
          setSummaries(newSummaries);
          setOffset(pageSize);
        }

        setLastUpdated(new Date());
        setIsCached(data.cached);
        if (data.cached && data.generated_at) {
          setCacheAge(formatCacheAge(data.generated_at));
        } else {
          setCacheAge(null);
        }
      } catch (err) {
        console.error("Failed to load summaries:", err);
        setError(
          err instanceof Error ? err.message : "Failed to connect to AI backend."
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [typeFilter, timeFilter, needsResponseOnly, offset, sortSummaries, globalChatFilters, folders]
  );

  const regenerateSingle = useCallback(
    async (chatId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      setRegeneratingChatId(chatId);

      try {
        const existingSummary = summaries.find((s) => s.chatId === chatId);
        if (!existingSummary || existingSummary.isLargeGroup) return;

        const messages = await tauri.getChatMessages(chatId, MESSAGES_PER_CHAT);

        const response = await fetch(`${API_URL}/api/summary/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chats: [
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
            regenerate: true,
          }),
        });

        if (!response.ok) throw new Error(`Backend error: ${response.status}`);

        const data = await response.json();

        // Validate response structure
        if (data && Array.isArray(data.summaries) && data.summaries.length > 0) {
          const newSummary = data.summaries[0];
          // Ensure the summary has required fields
          if (newSummary && typeof newSummary === "object" && newSummary.chat_id != null) {
            setSummaries((prev) =>
              prev.map((s) =>
                s.chatId === chatId
                  ? {
                      chatId: newSummary.chat_id,
                      chatTitle: newSummary.chat_title ?? s.chatTitle,
                      chatType: newSummary.chat_type ?? s.chatType,
                      summary: newSummary.summary ?? "No summary available",
                      keyPoints: Array.isArray(newSummary.key_points) ? newSummary.key_points : [],
                      actionItems: Array.isArray(newSummary.action_items) ? newSummary.action_items : [],
                      sentiment: newSummary.sentiment ?? "neutral",
                      needsResponse: Boolean(newSummary.needs_response),
                      messageCount: typeof newSummary.message_count === "number" ? newSummary.message_count : s.messageCount,
                      lastMessageDate: typeof newSummary.last_message_date === "number" ? newSummary.last_message_date : s.lastMessageDate,
                    }
                  : s
              )
            );
          }
        }
      } catch (err) {
        console.error("Failed to regenerate summary:", err);
      } finally {
        setRegeneratingChatId(null);
      }
    },
    [summaries]
  );

  useEffect(() => {
    if (summaries.length > 0) {
      setSummaries((prev) => sortSummaries(prev));
    }
  }, [sortBy, sortSummaries]);

  useEffect(() => {
    loadSummaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, timeFilter, needsResponseOnly, globalChatFilters, folders]);

  return {
    summaries,
    isLoading,
    error,
    lastUpdated,
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

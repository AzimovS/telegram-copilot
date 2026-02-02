import { useState, useCallback, useEffect } from "react";
import * as tauri from "@/lib/tauri";
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

  const pageSize = 10;

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
        const chats = (await tauri.getChats(100)) as Chat[];

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

        let newSummaries: ChatSummary[] = data.summaries.map((s: any) => ({
          chatId: s.chat_id,
          chatTitle: s.chat_title,
          chatType: s.chat_type,
          summary: s.summary,
          keyPoints: s.key_points,
          actionItems: s.action_items,
          sentiment: s.sentiment,
          needsResponse: s.needs_response,
          messageCount: s.message_count,
          lastMessageDate: s.last_message_date,
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
    [typeFilter, timeFilter, needsResponseOnly, offset, sortSummaries]
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
        if (data.summaries && data.summaries.length > 0) {
          const newSummary = data.summaries[0];
          setSummaries((prev) =>
            prev.map((s) =>
              s.chatId === chatId
                ? {
                    chatId: newSummary.chat_id,
                    chatTitle: newSummary.chat_title,
                    chatType: newSummary.chat_type,
                    summary: newSummary.summary,
                    keyPoints: newSummary.key_points,
                    actionItems: newSummary.action_items,
                    sentiment: newSummary.sentiment,
                    needsResponse: newSummary.needs_response,
                    messageCount: newSummary.message_count,
                    lastMessageDate: newSummary.last_message_date,
                  }
                : s
            )
          );
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
  }, [typeFilter, timeFilter, needsResponseOnly]);

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

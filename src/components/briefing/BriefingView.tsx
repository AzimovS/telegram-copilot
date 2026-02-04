import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ResponseCard } from "./ResponseCard";
import { FYIItem } from "./FYIItem";
import { Loader2, RefreshCw } from "lucide-react";
import * as tauri from "@/lib/tauri";
import { chatFiltersFromSettings } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import { useBriefingStore } from "@/stores/briefingStore";
import { useChatStore } from "@/stores/chatStore";
import type { Folder } from "@/types/telegram";

import type {
  FYIItemData,
  BriefingV2Response,
} from "@/lib/tauri";

interface BriefingViewProps {
  onOpenChat: (chatId: number, chatName: string, chatType?: string) => void;
}

type BriefingData = BriefingV2Response;

// Large groups (500+ members) are auto-classified as FYI to save API calls
const LARGE_GROUP_THRESHOLD = 500;

// Helper function to detect if there's an unanswered question
function detectQuestion(msgs: { isOutgoing: boolean; content: { type: string; text?: string } }[]): boolean {
  if (msgs.length === 0) return false;
  const lastNonOutgoing = [...msgs].reverse().find(m => !m.isOutgoing);
  return lastNonOutgoing?.content.type === "text" &&
         (lastNonOutgoing.content.text?.trim().endsWith("?") ?? false);
}

// Helper function to compute hours since last activity
function computeHoursSince(msgs: { date: number }[]): number {
  if (msgs.length === 0) return 999;
  const lastDate = msgs[msgs.length - 1].date;
  return (Date.now() / 1000 - lastDate) / 3600;
}

export function BriefingView({ onOpenChat }: BriefingViewProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const chatFilters = useSettingsStore((state) => state.chatFilters);
  const cacheTTL = useSettingsStore((state) => state.cacheTTL);

  // Use stores for persistent state
  const briefingStore = useBriefingStore();
  const chatStore = useChatStore();

  const { data, isLoading: loading, error } = briefingStore;

  // Load folders when selectedFolderIds changes
  useEffect(() => {
    if (chatFilters.selectedFolderIds.length > 0) {
      tauri.getFolders()
        .then(setFolders)
        .catch((err) => console.error("Failed to load folders:", err));
    } else {
      setFolders([]);
    }
  }, [chatFilters.selectedFolderIds]);

  const load = useCallback(async (force: boolean) => {
    // Check if we should skip loading (use cached data)
    if (!force && data && !briefingStore.shouldRefresh(cacheTTL.briefingTTLMinutes)) {
      return;
    }

    briefingStore.setLoading(true);
    briefingStore.setError(null);

    try {
      // Get chats with unread messages from Telegram (with filters)
      const filters = chatFiltersFromSettings(chatFilters, folders);
      const filtersHash = JSON.stringify(filters);

      // Use cached chats if available (2 min TTL for chat list)
      const shouldRefreshChats = chatStore.shouldRefreshChats(2, filtersHash);
      const chats = await chatStore.loadChats(100, filters, force || shouldRefreshChats);
      const unreadChats = chats.filter((c) => c.unreadCount > 0);

      if (unreadChats.length === 0) {
        briefingStore.setData({
          needs_response: [],
          fyi_summaries: [],
          stats: { needs_response_count: 0, fyi_count: 0, total_unread: 0 },
          generated_at: new Date().toISOString(),
          cached: false,
        });
        briefingStore.setLoading(false);
        return;
      }

      // Separate large groups from chats to process (large groups are auto-classified as FYI)
      const largeGroups = unreadChats.filter(
        (c) =>
          (c.type === "group" || c.type === "channel") &&
          (c.memberCount ?? 0) >= LARGE_GROUP_THRESHOLD
      );
      const smallChats = unreadChats.filter((c) => !largeGroups.includes(c));

      // Auto-generate FYI items for large groups (no AI needed)
      const largeGroupFYIs: FYIItemData[] = largeGroups.map((chat, idx) => ({
        id: Date.now() + idx,
        chat_id: chat.id,
        chat_name: chat.title,
        chat_type: chat.type === "private" ? "dm" : chat.type === "channel" ? "channel" : "group",
        unread_count: chat.unreadCount,
        last_message: chat.lastMessage?.content.type === "text" ? chat.lastMessage.content.text : null,
        last_message_date: chat.lastMessage ? new Date(chat.lastMessage.date * 1000).toISOString() : null,
        priority: "fyi" as const,
        summary: `${chat.unreadCount} new messages in large group`,
      }));

      // Get recent messages for each unread chat
      const chatContexts = [];
      const chatsToProcess = smallChats.slice(0, 20);
      for (let i = 0; i < chatsToProcess.length; i++) {
        const chat = chatsToProcess[i];
        try {
          // Use cached messages if available (2 min TTL for messages)
          const shouldRefreshMsgs = chatStore.shouldRefreshMessages(chat.id, 2);
          const messages = await chatStore.loadMessages(chat.id, 15, undefined, force || shouldRefreshMsgs);

          chatContexts.push({
            chat_id: chat.id,
            chat_title: chat.title,
            chat_type: chat.type,
            messages: messages.map((m) => ({
              id: Number(m.id),
              sender_name: m.senderName,
              text: m.content.type === "text" ? m.content.text : "[Media]",
              date: m.date,
              is_outgoing: m.isOutgoing,
            })),
            unread_count: chat.unreadCount,
            last_message_is_outgoing: messages.length > 0 && messages[messages.length - 1].isOutgoing,
            has_unanswered_question: detectQuestion(messages),
            hours_since_last_activity: computeHoursSince(messages),
            is_private_chat: chat.type === "private",
          });
          // Small delay between requests to avoid rate limiting (only if fetching fresh)
          if ((force || shouldRefreshMsgs) && i < chatsToProcess.length - 1) {
            await new Promise((r) => setTimeout(r, 50));
          }
        } catch (e) {
          console.warn(`Failed to get messages for chat ${chat.id}:`, e);
        }
      }

      if (chatContexts.length === 0) {
        // Even if no small chats to process, we may have large group FYIs
        const totalUnread = largeGroupFYIs.reduce((sum, item) => sum + item.unread_count, 0);
        briefingStore.setData({
          needs_response: [],
          fyi_summaries: largeGroupFYIs,
          stats: { needs_response_count: 0, fyi_count: largeGroupFYIs.length, total_unread: totalUnread },
          generated_at: new Date().toISOString(),
          cached: false,
        });
        briefingStore.setLoading(false);
        return;
      }

      // Call Tauri AI command
      const result: BriefingData = await tauri.generateBriefingV2(
        chatContexts,
        force,
        cacheTTL.briefingTTLMinutes
      );

      // Merge large group FYIs with AI-generated FYIs
      const mergedFYIs = [...result.fyi_summaries, ...largeGroupFYIs];
      const largeGroupUnreadTotal = largeGroupFYIs.reduce((sum, item) => sum + item.unread_count, 0);

      briefingStore.setData({
        ...result,
        fyi_summaries: mergedFYIs,
        stats: {
          ...result.stats,
          fyi_count: mergedFYIs.length,
          total_unread: result.stats.total_unread + largeGroupUnreadTotal,
        },
      });
    } catch (err) {
      console.error("Failed to load briefing:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load briefing";
      briefingStore.setError(errorMessage);
    } finally {
      briefingStore.setLoading(false);
    }
  }, [chatFilters, folders, cacheTTL, data, briefingStore, chatStore]);

  // Initial load - only if needed
  useEffect(() => {
    if (briefingStore.shouldRefresh(cacheTTL.briefingTTLMinutes)) {
      load(false);
    }
  }, [cacheTTL.briefingTTLMinutes]);

  // Reload when filters change
  useEffect(() => {
    load(false);
  }, [chatFilters, folders]);

  const removeItem = useCallback((chatId: number) => {
    briefingStore.removeItem(chatId);
  }, [briefingStore]);

  const handleSend = useCallback(async (chatId: number, message: string) => {
    await tauri.sendMessage(chatId, message);
  }, []);

  const handleGetDraft = useCallback(async (chatId: number): Promise<string> => {
    try {
      const messages = await chatStore.loadMessages(chatId, 20);
      const filters = chatFiltersFromSettings(chatFilters, folders);
      const chats = await chatStore.loadChats(100, filters);
      const chat = chats.find((c) => c.id === chatId);

      const result = await tauri.generateDraft(
        chatId,
        chat?.title || "Chat",
        messages.map((m) => ({
          sender_name: m.senderName,
          text: m.content.type === "text" ? m.content.text : "[Media]",
          is_outgoing: m.isOutgoing,
        }))
      );

      return result.draft || "";
    } catch (err) {
      console.error("Failed to generate draft:", err);
    }
    return "";
  }, [chatFilters, folders, chatStore]);

  // Calculate greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Loading state - only show full loading screen if no cached data
  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Analyzing inbox...</p>
      </div>
    );
  }

  const hasNeedsResponse = data && data.needs_response.length > 0;
  const hasFYI = data && data.fyi_summaries.length > 0;
  const isEmpty = !hasNeedsResponse && !hasFYI;

  // Error state UI
  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <p className="text-4xl mb-4">Warning</p>
        <p className="text-xl font-medium mb-2">Failed to load briefing</p>
        <p className="text-muted-foreground mb-4 text-center max-w-md">{error}</p>
        <Button variant="outline" onClick={() => load(true)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{getGreeting()}</h2>
        <div className="flex items-center gap-2">
          {data?.cached && data.cache_age && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
              Cached {data.cache_age}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Error Banner (when we have stale data) */}
      {error && data && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-red-700">Failed to refresh: {error}</span>
          <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={loading}>
            Retry
          </Button>
        </div>
      )}

      {/* Stats Bar */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
            <p className="text-3xl font-bold text-orange-600">
              {data.stats.needs_response_count}
            </p>
            <p className="text-sm text-orange-600/70">Need Reply</p>
          </div>
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-3xl font-bold text-blue-600">
              {data.stats.fyi_count}
            </p>
            <p className="text-sm text-blue-600/70">FYI</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <p className="text-3xl font-bold text-gray-600">
              {data.stats.total_unread}
            </p>
            <p className="text-sm text-gray-600/70">Unread</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-4xl mb-4">All caught up!</p>
          <p className="text-xl font-medium">No unread messages</p>
        </div>
      )}

      {/* Needs Reply Section */}
      {hasNeedsResponse && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Needs Reply ({data.needs_response.length})
          </h3>
          <div className="space-y-3">
            {data.needs_response.map((item) => (
              <ResponseCard
                key={item.id}
                item={item}
                onOpenChat={onOpenChat}
                onSend={handleSend}
                onDraft={handleGetDraft}
                onRemove={removeItem}
              />
            ))}
          </div>
        </section>
      )}

      {/* FYI Section */}
      {hasFYI && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            FYI ({data.fyi_summaries.length})
          </h3>
          <div className="space-y-2">
            {data.fyi_summaries.map((item) => (
              <FYIItem
                key={item.id}
                item={item}
                onOpenChat={() => {
                  const telegramType = item.chat_type === "dm" ? "private" : item.chat_type;
                  onOpenChat(item.chat_id, item.chat_name, telegramType);
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

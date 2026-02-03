import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ResponseCard } from "./ResponseCard";
import { FYIItem } from "./FYIItem";
import { Loader2, RefreshCw } from "lucide-react";
import * as tauri from "@/lib/tauri";
import { chatFiltersFromSettings } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Folder } from "@/types/telegram";

interface BriefingViewProps {
  onOpenChat: (chatId: number, chatName: string) => void;
}

interface ResponseItem {
  id: number;
  chat_id: number;
  chat_name: string;
  chat_type: "dm" | "group" | "channel";
  unread_count: number;
  last_message: string | null;
  last_message_date: string | null;
  priority: "urgent" | "needs_reply";
  summary: string;
  suggested_reply: string | null;
}

interface FYIItemData {
  id: number;
  chat_id: number;
  chat_name: string;
  chat_type: "dm" | "group" | "channel";
  unread_count: number;
  last_message: string | null;
  last_message_date: string | null;
  priority: "fyi";
  summary: string;
}

interface BriefingStats {
  needs_response_count: number;
  fyi_count: number;
  total_unread: number;
}

interface BriefingData {
  needs_response: ResponseItem[];
  fyi_summaries: FYIItemData[];
  stats: BriefingStats;
  generated_at: string;
  cached: boolean;
  cache_age?: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const chatFilters = useSettingsStore((state) => state.chatFilters);

  // Load folders when selectedFolderIds changes
  useEffect(() => {
    if (chatFilters.selectedFolderIds.length > 0) {
      tauri.getFolders()
        .then(setFolders)
        .catch((err) => console.error("Failed to load folders:", err));
    } else {
      setFolders([]);
    }
  }, [chatFilters.selectedFolderIds.length]);

  const load = useCallback(async (force: boolean) => {
    setLoading(true);
    setError(null);

    try {
      // Get chats with unread messages from Telegram (with filters)
      const filters = chatFiltersFromSettings(chatFilters, folders);
      const chats = await tauri.getChats(100, filters);
      const unreadChats = chats.filter((c) => c.unreadCount > 0);

      if (unreadChats.length === 0) {
        setData({
          needs_response: [],
          fyi_summaries: [],
          stats: { needs_response_count: 0, fyi_count: 0, total_unread: 0 },
          generated_at: new Date().toISOString(),
          cached: false,
        });
        setLoading(false);
        return;
      }

      // Separate large groups from chats to process (large groups are auto-classified as FYI)
      const largeGroups = unreadChats.filter(
        (c) =>
          (c.type === "group" || c.type === "supergroup" || c.type === "channel") &&
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

      // Get recent messages for each unread chat (limit to 20 per spec, reduced to avoid rate limits)
      const chatContexts = [];
      const chatsToProcess = smallChats.slice(0, 20); // Reduced from 40 to 20
      for (let i = 0; i < chatsToProcess.length; i++) {
        const chat = chatsToProcess[i];
        try {
          const messages = await tauri.getChatMessages(chat.id, 15); // Reduced from 20 to 15
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
            // Pre-computed signals for better classification
            unread_count: chat.unreadCount,
            last_message_is_outgoing: messages.length > 0 && messages[messages.length - 1].isOutgoing,
            has_unanswered_question: detectQuestion(messages),
            hours_since_last_activity: computeHoursSince(messages),
            is_private_chat: chat.type === "private",
          });
          // Small delay between requests to avoid rate limiting
          if (i < chatsToProcess.length - 1) {
            await new Promise((r) => setTimeout(r, 100));
          }
        } catch (e) {
          console.warn(`Failed to get messages for chat ${chat.id}:`, e);
        }
      }

      if (chatContexts.length === 0) {
        // Even if no small chats to process, we may have large group FYIs
        const totalUnread = largeGroupFYIs.reduce((sum, item) => sum + item.unread_count, 0);
        setData({
          needs_response: [],
          fyi_summaries: largeGroupFYIs,
          stats: { needs_response_count: 0, fyi_count: largeGroupFYIs.length, total_unread: totalUnread },
          generated_at: new Date().toISOString(),
          cached: false,
        });
        setLoading(false);
        return;
      }

      // Call V2 API endpoint
      const response = await fetch(`${API_URL}/api/briefing/v2/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chats: chatContexts,
          force_refresh: force,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const result: BriefingData = await response.json();

      // Merge large group FYIs with AI-generated FYIs
      const mergedFYIs = [...result.fyi_summaries, ...largeGroupFYIs];
      const largeGroupUnreadTotal = largeGroupFYIs.reduce((sum, item) => sum + item.unread_count, 0);

      setData({
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
      setError(errorMessage);
      // Keep previous data on error, but show error state
    } finally {
      setLoading(false);
    }
  }, [chatFilters, folders]);

  useEffect(() => {
    load(false);
  }, [load, chatFilters, folders]);

  const removeItem = useCallback((chatId: number) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        needs_response: prev.needs_response.filter(
          (item) => item.chat_id !== chatId
        ),
      };
    });
  }, []);

  const handleSend = useCallback(async (chatId: number, message: string) => {
    await tauri.sendMessage(chatId, message);
  }, []);

  const handleGetDraft = useCallback(async (chatId: number): Promise<string> => {
    try {
      const messages = await tauri.getChatMessages(chatId, 20);
      const chat = (await tauri.getChats(100)).find((c) => c.id === chatId);

      const response = await fetch(`${API_URL}/api/draft/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          chat_title: chat?.title || "Chat",
          messages: messages.map((m) => ({
            sender_name: m.senderName,
            text: m.content.type === "text" ? m.content.text : "[Media]",
            is_outgoing: m.isOutgoing,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.draft || "";
      }
    } catch (err) {
      console.error("Failed to generate draft:", err);
    }
    return "";
  }, []);

  // Calculate greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">🧠 Analyzing inbox...</p>
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
        <p className="text-4xl mb-4">⚠️</p>
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
              Cached • {data.cache_age}
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
          <p className="text-4xl mb-4">🎉</p>
          <p className="text-xl font-medium">All caught up!</p>
        </div>
      )}

      {/* Needs Reply Section */}
      {hasNeedsResponse && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            🔴 Needs Reply ({data.needs_response.length})
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
            🟡 FYI ({data.fyi_summaries.length})
          </h3>
          <div className="space-y-2">
            {data.fyi_summaries.map((item) => (
              <FYIItem
                key={item.id}
                item={item}
                onOpenChat={() => onOpenChat(item.chat_id, item.chat_name)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

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

interface BriefingViewProps {
  onOpenChat: (chatId: number, chatName: string, chatType?: string) => void;
}

export function BriefingView({ onOpenChat }: BriefingViewProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const chatFilters = useSettingsStore((state) => state.chatFilters);
  const cacheTTL = useSettingsStore((state) => state.cacheTTL);

  // Individual selectors: stable references, no unnecessary re-renders
  const data = useBriefingStore((s) => s.data);
  const loading = useBriefingStore((s) => s.isLoading);
  const error = useBriefingStore((s) => s.error);

  // Actions are referentially stable (created once in zustand create())
  const loadBriefing = useBriefingStore((s) => s.loadBriefing);
  const removeItem = useBriefingStore((s) => s.removeItem);

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

  // Load briefing when filters/folders/TTL change (dedup handled inside loadBriefing)
  useEffect(() => {
    const filters = chatFiltersFromSettings(chatFilters, folders);
    loadBriefing({
      filters,
      briefingTTLMinutes: cacheTTL.briefingTTLMinutes,
    });
  }, [chatFilters, folders, cacheTTL.briefingTTLMinutes, loadBriefing]);

  const handleRefresh = useCallback(() => {
    const filters = chatFiltersFromSettings(chatFilters, folders);
    loadBriefing({
      filters,
      force: true,
      briefingTTLMinutes: cacheTTL.briefingTTLMinutes,
    });
  }, [chatFilters, folders, cacheTTL.briefingTTLMinutes, loadBriefing]);

  const handleSend = useCallback(async (chatId: number, message: string) => {
    await tauri.sendMessage(chatId, message);
  }, []);

  const handleGetDraft = useCallback(async (chatId: number): Promise<string> => {
    try {
      const store = useChatStore.getState();
      const messages = await store.loadMessages(chatId, 20);
      const filters = chatFiltersFromSettings(chatFilters, folders);
      const chats = await store.loadChats(100, filters);
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
  }, [chatFilters, folders]);

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
        <Button variant="outline" onClick={handleRefresh}>
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
            <span className="text-xs bg-violet-100/50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 px-2 py-1 rounded-full border border-violet-200/50 dark:border-violet-800/40">
              Cached {data.cache_age}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
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
        <div className="bg-red-100/50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-red-700 dark:text-red-400">Failed to refresh: {error}</span>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading}>
            Retry
          </Button>
        </div>
      )}

      {/* Stats Bar */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-amber-100/40 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/40">
            <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">
              {data.stats.needs_response_count}
            </p>
            <p className="text-sm text-amber-600/70 dark:text-amber-500/70">Need Reply</p>
          </div>
          <div className="p-4 rounded-lg bg-sky-100/40 dark:bg-sky-950/30 border border-sky-200/50 dark:border-sky-800/40">
            <p className="text-3xl font-bold text-sky-700 dark:text-sky-400">
              {data.stats.fyi_count}
            </p>
            <p className="text-sm text-sky-600/70 dark:text-sky-500/70">FYI</p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-100/40 dark:bg-zinc-800/30 border border-zinc-200/50 dark:border-zinc-700/40">
            <p className="text-3xl font-bold text-zinc-600 dark:text-zinc-300">
              {data.stats.total_unread}
            </p>
            <p className="text-sm text-zinc-500/70 dark:text-zinc-400/70">Unread</p>
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

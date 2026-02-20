import { create } from "zustand";
import * as tauri from "@/lib/tauri";
import type { ChatFilters, FYIItemData, BriefingV2Response } from "@/lib/tauri";
import { useChatStore, DEFAULT_CHAT_LIMIT } from "@/stores/chatStore";
import type { Chat } from "@/types/telegram";

// Large groups (500+ members) are auto-classified as FYI to save API calls
const LARGE_GROUP_THRESHOLD = 500;

function detectQuestion(msgs: { isOutgoing: boolean; content: { type: string; text?: string } }[]): boolean {
  if (msgs.length === 0) return false;
  const lastNonOutgoing = [...msgs].reverse().find(m => !m.isOutgoing);
  return lastNonOutgoing?.content.type === "text" &&
         (lastNonOutgoing.content.text?.trim().endsWith("?") ?? false);
}

function computeHoursSince(msgs: { date: number }[]): number {
  if (msgs.length === 0) return 999;
  const lastDate = msgs[msgs.length - 1].date;
  return (Date.now() / 1000 - lastDate) / 3600;
}

interface BriefingStore {
  data: BriefingV2Response | null;
  isLoading: boolean;
  error: string | null;
  lastLoadedAt: number | null;
  lastFiltersHash: string | null;

  // Actions
  setData: (data: BriefingV2Response) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  removeItem: (chatId: number) => void;
  clear: () => void;
  loadBriefing: (options: {
    filters: ChatFilters;
    force?: boolean;
    briefingTTLMinutes: number;
  }) => Promise<void>;

  // Helpers
  shouldRefresh: (ttlMinutes: number, filtersHash?: string) => boolean;
}

// Module-level dedup: non-force calls share the in-flight promise.
// Force calls start a new load and use the generation counter to
// discard stale writes from any previously in-flight load.
let briefingPromise: Promise<void> | null = null;
let loadGeneration = 0;

export const useBriefingStore = create<BriefingStore>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  lastLoadedAt: null,
  lastFiltersHash: null,

  setData: (data) => {
    set({
      data,
      lastLoadedAt: Date.now(),
      error: null,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  removeItem: (chatId) => {
    set((state) => {
      if (!state.data) return state;
      return {
        data: {
          ...state.data,
          needs_response: state.data.needs_response.filter(
            (item) => item.chat_id !== chatId
          ),
        },
      };
    });
  },

  clear: () => {
    briefingPromise = null;
    loadGeneration = 0;
    set({ data: null, lastLoadedAt: null, lastFiltersHash: null, error: null });
  },

  loadBriefing: async ({ filters, force = false, briefingTTLMinutes }) => {
    const filtersHash = JSON.stringify(filters);

    // Non-force: return existing in-flight promise if one exists
    if (!force && briefingPromise) return briefingPromise;

    // Non-force: skip if cached data is still fresh
    if (!force && !get().shouldRefresh(briefingTTLMinutes, filtersHash)) return;

    const thisGeneration = ++loadGeneration;

    const doLoad = async () => {
      set({ isLoading: true, error: null });

      try {
        const chatStore = useChatStore.getState();

        // Use cached chats if available
        const shouldRefreshChats = chatStore.shouldRefreshChats(2, filtersHash);
        const chats = await chatStore.loadChats(DEFAULT_CHAT_LIMIT, filters, shouldRefreshChats);

        // Stale check: a newer load was started (force refresh while we were loading)
        if (thisGeneration !== loadGeneration) return;

        const unreadChats = chats.filter((c: Chat) => c.unreadCount > 0);

        if (unreadChats.length === 0) {
          set({
            data: {
              needs_response: [],
              fyi_summaries: [],
              stats: { needs_response_count: 0, fyi_count: 0, total_unread: 0 },
              generated_at: new Date().toISOString(),
              cached: false,
              cancelled: false,
            },
            lastLoadedAt: Date.now(),
            lastFiltersHash: filtersHash,
            error: null,
          });
          return;
        }

        // Separate large groups (auto-classified as FYI, no AI needed)
        const largeGroups = unreadChats.filter(
          (c: Chat) =>
            (c.type === "group" || c.type === "channel") &&
            (c.memberCount ?? 0) >= LARGE_GROUP_THRESHOLD
        );
        const smallChats = unreadChats.filter((c: Chat) => !largeGroups.includes(c));

        const largeGroupFYIs: FYIItemData[] = largeGroups.map((chat: Chat, idx: number) => ({
          id: Date.now() + idx,
          chat_id: chat.id,
          chat_name: chat.title,
          chat_type: chat.type === "channel" ? "channel" : "group",
          unread_count: chat.unreadCount,
          last_message: chat.lastMessage?.content.type === "text" ? chat.lastMessage.content.text : null,
          last_message_date: chat.lastMessage ? new Date(chat.lastMessage.date * 1000).toISOString() : null,
          priority: "fyi" as const,
          summary: `${chat.unreadCount} new messages in large group`,
        }));

        // Batch-fetch messages for small chats
        const batchRequests = smallChats.map((chat: Chat) => ({
          chatId: chat.id,
          limit: Math.min(Math.max(chat.unreadCount, 5), 30),
        }));
        const messagesByChat = await chatStore.batchLoadMessages(batchRequests);

        // Stale check after potentially slow network calls
        if (thisGeneration !== loadGeneration) return;

        // Pre-classify: group chats with no mentions and no outgoing messages
        // are auto-classified as FYI (user is not involved in the conversation)
        const uninvolvedGroups: Chat[] = [];
        const chatsForAI: Chat[] = [];
        for (const chat of smallChats) {
          const msgs = messagesByChat[chat.id];
          if (!msgs || msgs.length === 0) continue;
          const isPrivate = chat.type === "private";
          const hasOutgoing = msgs.some((m) => m.isOutgoing);
          const hasMention = msgs.some((m) => m.isMentioned);
          if (!isPrivate && !hasOutgoing && !hasMention) {
            uninvolvedGroups.push(chat);
          } else {
            chatsForAI.push(chat);
          }
        }

        const uninvolvedGroupFYIs: FYIItemData[] = uninvolvedGroups.map((chat: Chat, idx: number) => ({
          id: Date.now() + 10000 + idx,
          chat_id: chat.id,
          chat_name: chat.title,
          chat_type: chat.type === "channel" ? "channel" : "group",
          unread_count: chat.unreadCount,
          last_message: chat.lastMessage?.content.type === "text" ? chat.lastMessage.content.text : null,
          last_message_date: chat.lastMessage ? new Date(chat.lastMessage.date * 1000).toISOString() : null,
          priority: "fyi" as const,
          summary: `${chat.unreadCount} new messages (no mentions of you)`,
        }));

        // Build chat contexts for chats that need AI classification
        const chatContexts = chatsForAI
          .filter((chat: Chat) => (messagesByChat[chat.id]?.length ?? 0) > 0)
          .map((chat: Chat) => {
            const messages = messagesByChat[chat.id];
            return {
              chat_id: chat.id,
              chat_title: chat.title,
              chat_type: chat.type,
              messages: messages.map((m) => ({
                id: Number(m.id),
                sender_name: m.senderName,
                text: m.content.type === "text" ? m.content.text : "[Media]",
                date: m.date,
                is_outgoing: m.isOutgoing,
                is_mentioned: m.isMentioned,
              })),
              unread_count: chat.unreadCount,
              last_message_is_outgoing: messages.length > 0 && messages[messages.length - 1].isOutgoing,
              has_unanswered_question: detectQuestion(messages),
              hours_since_last_activity: computeHoursSince(messages),
              is_private_chat: chat.type === "private",
            };
          });

        if (chatContexts.length === 0) {
          const allAutoFYIs = [...largeGroupFYIs, ...uninvolvedGroupFYIs];
          const totalUnread = allAutoFYIs.reduce((sum, item) => sum + item.unread_count, 0);
          set({
            data: {
              needs_response: [],
              fyi_summaries: allAutoFYIs,
              stats: { needs_response_count: 0, fyi_count: allAutoFYIs.length, total_unread: totalUnread },
              generated_at: new Date().toISOString(),
              cached: false,
              cancelled: false,
            },
            lastLoadedAt: Date.now(),
            lastFiltersHash: filtersHash,
            error: null,
          });
          return;
        }

        // Call AI
        const result: BriefingV2Response = await tauri.generateBriefingV2(
          chatContexts,
          force,
          briefingTTLMinutes
        );

        // Stale check after AI call (the slowest part)
        if (thisGeneration !== loadGeneration) return;

        // Merge auto-classified FYIs with AI-generated FYIs
        const mergedFYIs = [...result.fyi_summaries, ...largeGroupFYIs, ...uninvolvedGroupFYIs];
        const autoFYIUnreadTotal = [...largeGroupFYIs, ...uninvolvedGroupFYIs].reduce((sum, item) => sum + item.unread_count, 0);

        set({
          data: {
            ...result,
            fyi_summaries: mergedFYIs,
            stats: {
              ...result.stats,
              fyi_count: mergedFYIs.length,
              total_unread: result.stats.total_unread + autoFYIUnreadTotal,
            },
          },
          lastLoadedAt: Date.now(),
          lastFiltersHash: filtersHash,
          error: null,
        });
      } catch (err) {
        if (thisGeneration !== loadGeneration) return;
        console.error("Failed to load briefing:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to load briefing";
        set({ error: errorMessage });
      } finally {
        // Only clean up if this is still the latest generation
        if (thisGeneration === loadGeneration) {
          set({ isLoading: false });
          briefingPromise = null;
        }
      }
    };

    briefingPromise = doLoad();
    return briefingPromise;
  },

  shouldRefresh: (ttlMinutes, filtersHash?) => {
    const { lastLoadedAt, data, lastFiltersHash } = get();
    if (!data || !lastLoadedAt) return true;
    if (filtersHash && lastFiltersHash !== filtersHash) return true;
    const ageMs = Date.now() - lastLoadedAt;
    const ttlMs = ttlMinutes * 60 * 1000;
    return ageMs >= ttlMs;
  },
}));

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatsBar } from "./StatsBar";
import { ResponseCard, type ResponseItem } from "./ResponseCard";
import { FYIItem, type FYIItemData } from "./FYIItem";
import { BriefingCard, type BriefingItem } from "./BriefingCard";
import { RefreshCw, Loader2, Clock, Sparkles, AlertCircle, PartyPopper } from "lucide-react";
import * as tauri from "@/lib/tauri";
import { useAuthStore } from "@/stores/authStore";

interface SmartBriefingProps {
  onOpenChat: (chatId: number) => void;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface ChatMessage {
  id: number;
  sender_name: string;
  text: string;
  date: number;
  is_outgoing: boolean;
}

interface ChatContext {
  chat_id: number;
  chat_title: string;
  chat_type: string;
  messages: ChatMessage[];
}

interface BriefingResponse {
  briefings: Array<{
    chat_id: number;
    chat_title: string;
    category: "urgent" | "needs_reply" | "fyi";
    summary: string;
    key_points: string[];
    suggested_action?: string;
    suggested_reply?: string;
    last_message?: string;
    last_message_sender?: string;
    unread_count: number;
    last_message_date: number;
  }>;
  generated_at: number;
  cached: boolean;
}

export function SmartBriefing({ onOpenChat }: SmartBriefingProps) {
  const { currentUser } = useAuthStore();
  const [briefings, setBriefings] = useState<BriefingItem[]>([]);
  const [responseItems, setResponseItems] = useState<ResponseItem[]>([]);
  const [fyiItems, setFyiItems] = useState<FYIItemData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBriefings = useCallback(async (regenerate = false) => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Get chats with unread messages from Telegram
      const chats = await tauri.getChats(50);
      const unreadChats = chats.filter((c) => c.unreadCount > 0);

      if (unreadChats.length === 0) {
        setBriefings([]);
        setResponseItems([]);
        setFyiItems([]);
        setLastUpdated(new Date());
        setIsLoading(false);
        return;
      }

      // 2. Get recent messages for each unread chat
      const chatContexts: ChatContext[] = [];

      for (const chat of unreadChats.slice(0, 10)) {
        try {
          const messages = await tauri.getChatMessages(chat.id, 20);
          const recentMessages = messages.slice(-20);

          chatContexts.push({
            chat_id: chat.id,
            chat_title: chat.title,
            chat_type: chat.type,
            messages: recentMessages.map((m) => ({
              id: Number(m.id),
              sender_name: m.senderName,
              text: m.content.type === "text" ? m.content.text : "[Media]",
              date: m.date,
              is_outgoing: m.isOutgoing,
            })),
          });
        } catch (e) {
          console.warn(`Failed to get messages for chat ${chat.id}:`, e);
        }
      }

      if (chatContexts.length === 0) {
        setBriefings([]);
        setResponseItems([]);
        setFyiItems([]);
        setLastUpdated(new Date());
        setIsLoading(false);
        return;
      }

      // 3. Send to AI backend for processing
      const response = await fetch(`${API_URL}/api/briefing/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chats: chatContexts,
          regenerate,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data: BriefingResponse = await response.json();

      // 4. Separate into categories
      const urgent: BriefingItem[] = [];
      const needsReply: ResponseItem[] = [];
      const fyi: FYIItemData[] = [];

      for (const b of data.briefings) {
        if (b.category === "urgent") {
          urgent.push({
            chatId: b.chat_id,
            chatTitle: b.chat_title,
            category: b.category,
            summary: b.summary,
            keyPoints: b.key_points,
            suggestedAction: b.suggested_action,
            unreadCount: b.unread_count,
            lastMessageDate: b.last_message_date,
          });
        } else if (b.category === "needs_reply") {
          needsReply.push({
            chatId: b.chat_id,
            chatTitle: b.chat_title,
            summary: b.summary,
            lastMessage: b.last_message,
            lastMessageSender: b.last_message_sender,
            suggestedReply: b.suggested_reply,
            unreadCount: b.unread_count,
            lastMessageDate: b.last_message_date,
          });
        } else {
          fyi.push({
            chatId: b.chat_id,
            chatTitle: b.chat_title,
            summary: b.summary,
            unreadCount: b.unread_count,
            lastMessageDate: b.last_message_date,
          });
        }
      }

      setBriefings(urgent);
      setResponseItems(needsReply);
      setFyiItems(fyi);
      setLastUpdated(new Date());
      setIsCached(data.cached);
    } catch (err) {
      console.error("Failed to load briefings:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to connect to AI backend. Make sure the backend is running."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBriefings();
  }, [loadBriefings]);

  const handleResponseSent = (chatId: number) => {
    setResponseItems((prev) => prev.filter((item) => item.chatId !== chatId));
  };

  const urgentCount = briefings.length;
  const needsReplyCount = responseItems.length;
  const fyiCount = fyiItems.length;
  const totalCount = urgentCount + needsReplyCount + fyiCount;

  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = currentUser?.firstName || "there";
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{getGreeting()}</h1>
            <p className="text-sm text-muted-foreground">
              {totalCount > 0
                ? `You have ${totalCount} conversation${totalCount !== 1 ? "s" : ""} to review`
                : "All caught up!"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isCached ? "Cached • " : ""}
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => loadBriefings(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">
              {isLoading ? "Analyzing..." : "Refresh"}
            </span>
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <br />
            <span className="text-xs mt-1 block">
              Start the backend with: cd backend && docker-compose up -d
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && totalCount === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">
            Analyzing your conversations...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && totalCount === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <PartyPopper className="h-12 w-12 text-primary mb-4" />
          <h2 className="text-xl font-semibold mb-2">All caught up!</h2>
          <p className="text-muted-foreground">No unread messages to review</p>
        </div>
      )}

      {/* Content */}
      {totalCount > 0 && (
        <>
          {/* Stats Bar */}
          <StatsBar
            urgentCount={urgentCount}
            needsReplyCount={needsReplyCount}
            fyiCount={fyiCount}
          />

          {/* Urgent Section */}
          {urgentCount > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <h2 className="font-semibold text-lg">Urgent</h2>
                <span className="text-sm text-muted-foreground">
                  ({urgentCount})
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {briefings.map((briefing) => (
                  <BriefingCard
                    key={briefing.chatId}
                    briefing={briefing}
                    onOpenChat={() => onOpenChat(briefing.chatId)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Needs Reply Section */}
          {needsReplyCount > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <h2 className="font-semibold text-lg">Needs Reply</h2>
                <span className="text-sm text-muted-foreground">
                  ({needsReplyCount})
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {responseItems.map((item) => (
                  <ResponseCard
                    key={item.chatId}
                    item={item}
                    onOpenChat={() => onOpenChat(item.chatId)}
                    onSent={() => handleResponseSent(item.chatId)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* FYI Section */}
          {fyiCount > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-blue-500 text-lg">ℹ️</span>
                <h2 className="font-semibold text-lg">For Your Information</h2>
                <span className="text-sm text-muted-foreground">
                  ({fyiCount})
                </span>
              </div>
              <div className="space-y-2">
                {fyiItems.map((item) => (
                  <FYIItem
                    key={item.chatId}
                    item={item}
                    onOpenChat={() => onOpenChat(item.chatId)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

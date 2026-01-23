import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CategoryGroup } from "./CategoryGroup";
import type { BriefingItem } from "./BriefingCard";
import { RefreshCw, Loader2, Clock, Sparkles, AlertCircle } from "lucide-react";
import * as tauri from "@/lib/tauri";

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
    unread_count: number;
    last_message_date: number;
  }>;
  generated_at: number;
  cached: boolean;
}

export function SmartBriefing({ onOpenChat }: SmartBriefingProps) {
  const [briefings, setBriefings] = useState<BriefingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBriefings = async (regenerate = false) => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Get chats with unread messages from Telegram
      const chats = await tauri.getChats(50);
      const unreadChats = chats.filter((c) => c.unreadCount > 0);

      if (unreadChats.length === 0) {
        setBriefings([]);
        setLastUpdated(new Date());
        setIsLoading(false);
        return;
      }

      // 2. Get recent messages for each unread chat
      const chatContexts: ChatContext[] = [];

      for (const chat of unreadChats.slice(0, 10)) {
        // Limit to 10 chats
        try {
          const messages = await tauri.getChatMessages(chat.id, 20);
          const recentMessages = messages.slice(-20); // Last 20 messages

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

      // 4. Map to BriefingItem format
      const items: BriefingItem[] = data.briefings.map((b) => ({
        chatId: b.chat_id,
        chatTitle: b.chat_title,
        category: b.category,
        summary: b.summary,
        keyPoints: b.key_points,
        suggestedAction: b.suggested_action,
        unreadCount: b.unread_count,
        lastMessageDate: b.last_message_date,
      }));

      setBriefings(items);
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
  };

  useEffect(() => {
    loadBriefings();
  }, []);

  const urgentBriefings = briefings.filter((b) => b.category === "urgent");
  const needsReplyBriefings = briefings.filter(
    (b) => b.category === "needs_reply"
  );
  const fyiBriefings = briefings.filter((b) => b.category === "fyi");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Smart Briefing</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered summary of your conversations
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
              {isLoading ? "Analyzing..." : "Regenerate"}
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
      {isLoading && briefings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">
            Analyzing your conversations...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && briefings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <Sparkles className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No unread messages to brief</p>
        </div>
      )}

      {/* Briefing Categories */}
      {briefings.length > 0 && (
        <div className="space-y-8">
          <CategoryGroup
            category="urgent"
            briefings={urgentBriefings}
            onOpenChat={onOpenChat}
          />
          <CategoryGroup
            category="needs_reply"
            briefings={needsReplyBriefings}
            onOpenChat={onOpenChat}
          />
          <CategoryGroup
            category="fyi"
            briefings={fyiBriefings}
            onOpenChat={onOpenChat}
          />
        </div>
      )}
    </div>
  );
}

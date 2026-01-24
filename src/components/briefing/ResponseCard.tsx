import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Sparkles,
  Send,
  Loader2,
  Check,
  ExternalLink,
} from "lucide-react";
import * as tauri from "@/lib/tauri";

export interface ResponseItem {
  chatId: number;
  chatTitle: string;
  summary: string;
  lastMessage?: string;
  lastMessageSender?: string;
  suggestedReply?: string;
  unreadCount: number;
  lastMessageDate: number;
}

interface ResponseCardProps {
  item: ResponseItem;
  onOpenChat: () => void;
  onSent: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function ResponseCard({ item, onOpenChat, onSent }: ResponseCardProps) {
  const [draft, setDraft] = useState(item.suggestedReply || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleGenerateDraft = async () => {
    setIsGenerating(true);
    try {
      // Get recent messages for context
      const messages = await tauri.getChatMessages(item.chatId, 20);
      const recentMessages = messages.slice(-10).map((m) => ({
        sender_name: m.senderName,
        text: m.content.type === "text" ? m.content.text : "[Media]",
        is_outgoing: m.isOutgoing,
      }));

      const response = await fetch(`${API_URL}/api/draft/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: item.chatId,
          chat_title: item.chatTitle,
          messages: recentMessages,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setDraft(data.draft || "");
      }
    } catch (error) {
      console.error("Failed to generate draft:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!draft.trim() || isSending) return;

    setIsSending(true);
    try {
      await tauri.sendMessage(item.chatId, draft.trim());
      setIsSent(true);
      setTimeout(() => {
        onSent();
      }, 500);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isSent) {
    return (
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="py-6 flex items-center justify-center gap-2 text-green-600">
          <Check className="h-5 w-5" />
          <span className="font-medium">Message Sent</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-500/20">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <button
            onClick={onOpenChat}
            className="text-left hover:underline flex-1"
          >
            <h3 className="font-semibold text-base">{item.chatTitle}</h3>
          </button>
          {item.unreadCount > 0 && (
            <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full ml-2 shrink-0">
              {item.unreadCount}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary */}
        <p className="text-sm text-muted-foreground">{item.summary}</p>

        {/* Last Message */}
        {item.lastMessage && (
          <button
            onClick={onOpenChat}
            className="w-full text-left p-2 bg-muted/50 rounded text-sm hover:bg-muted transition-colors"
          >
            <span className="font-medium text-xs text-muted-foreground">
              {item.lastMessageSender}:
            </span>
            <p className="line-clamp-2 mt-0.5">{item.lastMessage}</p>
          </button>
        )}

        {/* Reply Draft */}
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setDraft(e.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder="Type your reply..."
            className="resize-none min-h-[60px] text-sm"
            rows={2}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateDraft}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                AI
              </Button>
              <Button variant="ghost" size="sm" onClick={onOpenChat}>
                <ExternalLink className="h-3 w-3 mr-1" />
                Open
              </Button>
            </div>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!draft.trim() || isSending}
            >
              {isSending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Send className="h-3 w-3 mr-1" />
              )}
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

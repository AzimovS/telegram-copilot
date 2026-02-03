import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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

interface ResponseCardProps {
  item: ResponseItem;
  onOpenChat: (chatId: number, chatName: string, chatType?: string) => void;
  onSend: (chatId: number, message: string) => Promise<void>;
  onDraft: (chatId: number) => Promise<string>;
  onRemove: (chatId: number) => void;
}

export function ResponseCard({
  item,
  onOpenChat,
  onSend,
  onDraft,
  onRemove,
}: ResponseCardProps) {
  const [draft, setDraft] = useState(item.suggested_reply || "");
  const [sending, setSending] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleOpenChat = () => {
    // Convert briefing chat_type to Telegram ChatType
    const telegramType = item.chat_type === "dm" ? "private" : item.chat_type;
    onOpenChat(item.chat_id, item.chat_name, telegramType);
  };

  const handleAIDraft = async () => {
    setLoadingDraft(true);
    try {
      const newDraft = await onDraft(item.chat_id);
      setDraft(newDraft);
    } catch (err) {
      console.error("Failed to generate draft:", err);
    } finally {
      setLoadingDraft(false);
    }
  };

  const handleSend = async () => {
    if (!draft.trim() || sending) return;

    setSending(true);
    setSendError(null);
    try {
      await onSend(item.chat_id, draft);
      setSent(true);
      setTimeout(() => {
        onRemove(item.chat_id);
      }, 500);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Unknown error");
      setSending(false);
    }
  };

  const handleRetry = () => {
    setSendError(null);
    handleSend();
  };

  // Sent state - show confirmation
  if (sent) {
    return (
      <Card className="bg-green-50 border-green-200">
        <CardContent className="py-6 text-center">
          <p className="text-green-700 font-medium">
            ✅ Sent to {item.chat_name}
          </p>
        </CardContent>
      </Card>
    );
  }

  const chatTypeLabel = item.chat_type === "dm" ? "DM" : item.chat_type === "group" ? "Group" : "Channel";

  return (
    <Card>
      <CardHeader className="pb-2">
        {/* Card Title - Clickable */}
        <div className="flex items-start justify-between">
          <button
            onClick={handleOpenChat}
            className="text-left flex-1 hover:underline"
          >
            <h4 className="font-semibold">{item.chat_name}</h4>
            <p className="text-xs text-muted-foreground">
              {chatTypeLabel} · {item.unread_count} unread
            </p>
          </button>
          {/* Priority Badge */}
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              item.priority === "urgent"
                ? "bg-red-100 text-red-700"
                : "bg-orange-100 text-orange-700"
            }`}
          >
            {item.priority === "urgent" ? "🔴 Urgent" : "🟠 Reply"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Last Message - Clickable */}
        {item.last_message && (
          <button
            onClick={handleOpenChat}
            className="w-full text-left p-2 bg-muted/50 rounded text-sm hover:bg-muted transition-colors"
          >
            <p className="line-clamp-2 text-muted-foreground">
              "{item.last_message}"
            </p>
          </button>
        )}

        {/* AI Summary */}
        {item.summary && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">AI:</span> {item.summary}
          </div>
        )}

        {/* Send Error Banner */}
        {sendError && (
          <div className="flex items-center justify-between gap-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
            <span className="text-red-700">Failed to send: {sendError}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="shrink-0"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Draft Textarea */}
        <Textarea
          value={draft}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setDraft(e.target.value)
          }
          placeholder="Your reply..."
          className="resize-none text-sm"
          rows={2}
        />

        {/* Card Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* AI Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAIDraft}
              disabled={loadingDraft}
            >
              {loadingDraft ? "⏳" : "✨ AI"}
            </Button>

            {/* Open Button */}
            <Button variant="outline" size="sm" onClick={handleOpenChat}>
              💬 Open
            </Button>
          </div>

          {/* Send Button */}
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!draft.trim() || sending}
          >
            {sending ? "⏳" : "📨 Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

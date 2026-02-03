import { useState, useEffect, useRef } from "react";
import { X, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import * as tauri from "@/lib/tauri";
import type { Chat, Message } from "@/types/telegram";

interface ChatPanelProps {
  chatId: number | null;
  chatName?: string;
  chatType?: string;
  onClose: () => void;
}

export function ChatPanel({ chatId, chatName, chatType, onClose }: ChatPanelProps) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isOpen = chatId !== null;

  // Load chat and messages when chatId changes
  useEffect(() => {
    if (chatId === null) {
      setChat(null);
      setMessages([]);
      setDraft("");
      return;
    }

    // Abort flag to prevent stale data when rapidly switching chats
    let cancelled = false;

    const loadChat = async () => {
      setIsLoading(true);
      try {
        // Get chat info - pass undefined for filters to get all chats
        // This ensures we find the chat even if it doesn't match current filters
        const chats = await tauri.getChats(100, undefined);
        if (cancelled) return;

        const foundChat = chats.find((c) => c.id === chatId);
        if (foundChat) {
          setChat(foundChat);
        }

        // Get messages
        const msgs = await tauri.getChatMessages(chatId, 50);
        if (cancelled) return;

        setMessages(msgs);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load chat:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadChat();

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!chatId || !draft.trim() || isSending) return;

    setIsSending(true);
    try {
      const newMessage = await tauri.sendMessage(chatId, draft.trim());
      setMessages((prev) => [...prev, newMessage]);
      setDraft("");
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

  const handleGenerateDraft = async () => {
    if (!chatId || messages.length === 0) return;

    setIsGeneratingDraft(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

      // Prepare messages for the AI - take last 20 messages for context
      const recentMessages = messages.slice(-20).map((msg) => ({
        sender_name: msg.isOutgoing ? "You" : (msg.senderName || "User"),
        text: msg.content.type === "text" ? msg.content.text : `[${msg.content.type}]`,
        is_outgoing: msg.isOutgoing,
      }));

      const response = await fetch(`${API_URL}/api/draft/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          chat_title: chat?.title || chatName || "Chat",
          messages: recentMessages,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate draft: ${response.statusText}`);
      }

      const data = await response.json();
      setDraft(data.draft);
    } catch (error) {
      console.error("Failed to generate AI draft:", error);
      // Show more specific error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        setDraft("Could not connect to AI backend. Make sure the backend server is running (cd backend && uvicorn app.main:app --reload --port 8000)");
      } else {
        setDraft(`Draft generation failed: ${errorMessage}`);
      }
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={cn(
        "fixed top-14 right-0 bottom-0 w-[400px] bg-background border-l flex flex-col transition-transform duration-300 z-40",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="text-xl shrink-0">
            {(chat?.type || chatType) === "private" ? "💬" :
             (chat?.type || chatType) === "group" || (chat?.type || chatType) === "supergroup" ? "👥" :
             (chat?.type || chatType) === "channel" ? "📢" :
             (chat?.type || chatType) === "secret" ? "🔒" : "💬"}
          </span>
          <span className="font-medium truncate">{chat?.title || chatName || "Chat"}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No messages yet
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex flex-col max-w-[85%]",
                msg.isOutgoing ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              {!msg.isOutgoing && (
                <span className="text-xs text-muted-foreground mb-1">
                  {msg.senderName}
                </span>
              )}
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  msg.isOutgoing
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.content.type === "text" ? msg.content.text : "[Media]"}
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                {formatTime(msg.date)}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t p-4 space-y-3 shrink-0">
        <Textarea
          value={draft}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="resize-none min-h-[80px]"
          rows={3}
        />
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateDraft}
            disabled={isGeneratingDraft}
          >
            {isGeneratingDraft ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            AI Draft
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!draft.trim() || isSending}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

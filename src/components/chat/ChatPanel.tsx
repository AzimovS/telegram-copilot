import { useState, useEffect, useRef } from "react";
import { X, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import * as tauri from "@/lib/tauri";
import type { Chat, Message } from "@/types/telegram";

interface ChatPanelProps {
  chatId: number | null;
  onClose: () => void;
}

export function ChatPanel({ chatId, onClose }: ChatPanelProps) {
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

    const loadChat = async () => {
      setIsLoading(true);
      try {
        // Get chat info
        const chats = await tauri.getChats(100);
        const foundChat = chats.find((c) => c.id === chatId);
        if (foundChat) {
          setChat(foundChat);
        }

        // Get messages
        const msgs = await tauri.getChatMessages(chatId, 50);
        setMessages(msgs);
      } catch (error) {
        console.error("Failed to load chat:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChat();
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
    // TODO: Implement AI draft generation
    setIsGeneratingDraft(true);
    try {
      // Placeholder - in Phase 2, this will call an AI endpoint
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setDraft("Thanks for your message! I'll get back to you soon.");
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
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary shrink-0">
            {chat?.title?.[0] || "?"}
          </div>
          <span className="font-medium truncate">{chat?.title || "Chat"}</span>
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

import { useState, useCallback } from "react";
import { MessageList } from "./MessageList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Chat, Message } from "@/types/telegram";
import { Send, Paperclip, Smile, MoreVertical } from "lucide-react";

interface ChatPanelProps {
  chat: Chat | null;
  messages: Message[];
  onSendMessage: (text: string) => void;
  onLoadMore: () => void;
  isLoading: boolean;
}

export function ChatPanel({
  chat,
  messages,
  onSendMessage,
  onLoadMore,
  isLoading,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (text) {
      onSendMessage(text);
      setInputValue("");
    }
  }, [inputValue, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!chat) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Select a chat to start messaging
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          {chat.photo ? (
            <img
              src={chat.photo}
              alt={chat.title}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-medium text-primary">
                {chat.title[0]}
              </span>
            </div>
          )}
          <div>
            <h2 className="font-semibold">{chat.title}</h2>
            <p className="text-xs text-muted-foreground">
              {chat.type === "private"
                ? "Private chat"
                : chat.type === "channel"
                ? "Channel"
                : "Group"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages */}
      <MessageList
        messages={messages}
        onLoadMore={onLoadMore}
        isLoading={isLoading}
      />

      {/* Input Area */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="flex-shrink-0">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button variant="ghost" size="icon" className="flex-shrink-0">
            <Smile className="h-5 w-5" />
          </Button>
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            size="icon"
            className="flex-shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

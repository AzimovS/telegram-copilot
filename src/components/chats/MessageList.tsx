import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/telegram";
import { Check, CheckCheck } from "lucide-react";

interface MessageListProps {
  messages: Message[];
  onLoadMore?: () => void;
  isLoading?: boolean;
}

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageContent({ content }: { content: Message["content"] }) {
  switch (content.type) {
    case "text":
      return <span className="whitespace-pre-wrap break-words">{content.text}</span>;
    case "photo":
      return (
        <div>
          <div className="bg-muted rounded h-32 flex items-center justify-center text-muted-foreground">
            [Photo]
          </div>
          {content.caption && (
            <p className="mt-1 text-sm">{content.caption}</p>
          )}
        </div>
      );
    case "video":
      return (
        <div>
          <div className="bg-muted rounded h-32 flex items-center justify-center text-muted-foreground">
            [Video]
          </div>
          {content.caption && (
            <p className="mt-1 text-sm">{content.caption}</p>
          )}
        </div>
      );
    case "document":
      return (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
          <span className="text-2xl">📄</span>
          <span className="truncate">{content.fileName}</span>
        </div>
      );
    case "voice":
      return (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
          <span className="text-2xl">🎤</span>
          <span>Voice message ({content.duration}s)</span>
        </div>
      );
    case "sticker":
      return (
        <div className="text-6xl">{content.emoji || "🎨"}</div>
      );
    default:
      return <span className="text-muted-foreground">[Unsupported message]</span>;
  }
}

function MessageBubble({ message }: { message: Message }) {
  const isOutgoing = message.isOutgoing;

  return (
    <div
      className={cn(
        "flex",
        isOutgoing ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[70%] rounded-lg px-3 py-2",
          isOutgoing
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        {!isOutgoing && (
          <p className="text-xs font-medium text-primary mb-1">
            {message.senderName}
          </p>
        )}
        <MessageContent content={message.content} />
        <div
          className={cn(
            "flex items-center justify-end gap-1 mt-1",
            isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          <span className="text-xs">{formatMessageTime(message.date)}</span>
          {isOutgoing && (
            message.isRead ? (
              <CheckCheck className="h-3 w-3" />
            ) : (
              <Check className="h-3 w-3" />
            )
          )}
        </div>
      </div>
    </div>
  );
}

export function MessageList({ messages, onLoadMore, isLoading }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<number | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      const latestId = messages[0]?.id;
      if (latestId !== lastMessageRef.current) {
        lastMessageRef.current = latestId;
        containerRef.current?.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [messages]);

  // Handle scroll for loading more
  const handleScroll = () => {
    if (!containerRef.current || !onLoadMore) return;
    const { scrollTop } = containerRef.current;
    if (scrollTop < 100) {
      onLoadMore();
    }
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        No messages yet
      </div>
    );
  }

  // Messages are in reverse chronological order (newest first)
  // Display them in chronological order (oldest first at top)
  const sortedMessages = [...messages].reverse();

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 space-y-2"
      onScroll={handleScroll}
    >
      {isLoading && (
        <div className="flex justify-center py-2">
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      )}
      {sortedMessages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}

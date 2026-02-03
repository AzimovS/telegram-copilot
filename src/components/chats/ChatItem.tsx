import { cn } from "@/lib/utils";
import type { Chat } from "@/types/telegram";

interface ChatItemProps {
  chat: Chat;
  isSelected: boolean;
  onClick: () => void;
}

function getChatEmoji(type: string) {
  switch (type) {
    case "private":
      return "💬";
    case "group":
    case "supergroup":
      return "👥";
    case "channel":
      return "📢";
    case "secret":
      return "🔒";
    default:
      return "💬";
  }
}

function formatLastMessageTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (days === 1) {
    return "Yesterday";
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

function getLastMessagePreview(chat: Chat): string {
  if (!chat.lastMessage) return "";

  const content = chat.lastMessage.content;
  switch (content.type) {
    case "text":
      return content.text;
    case "photo":
      return content.caption || "Photo";
    case "video":
      return content.caption || "Video";
    case "document":
      return content.fileName;
    case "voice":
      return "Voice message";
    case "sticker":
      return content.emoji || "Sticker";
    default:
      return "Message";
  }
}

export function ChatItem({ chat, isSelected, onClick }: ChatItemProps) {
  const emoji = getChatEmoji(chat.type);
  const lastMessageTime = chat.lastMessage
    ? formatLastMessageTime(chat.lastMessage.date)
    : "";
  const preview = getLastMessagePreview(chat);

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors",
        isSelected && "bg-muted"
      )}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="h-12 w-12 flex items-center justify-center">
          <span className="text-3xl">{emoji}</span>
        </div>
        {chat.unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
            {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate">{chat.title}</span>
          {lastMessageTime && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {lastMessageTime}
            </span>
          )}
        </div>
        {preview && (
          <p className="text-sm text-muted-foreground truncate">{preview}</p>
        )}
      </div>

      {/* Pin indicator */}
      {chat.isPinned && (
        <div className="flex-shrink-0 text-muted-foreground">
          <svg
            className="h-4 w-4"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16a1 1 0 11-2 0V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
          </svg>
        </div>
      )}
    </div>
  );
}

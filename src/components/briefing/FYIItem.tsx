import { cn } from "@/lib/utils";
import { Info, ChevronRight } from "lucide-react";

export interface FYIItemData {
  chatId: number;
  chatTitle: string;
  summary: string;
  unreadCount: number;
  lastMessageDate: number;
}

interface FYIItemProps {
  item: FYIItemData;
  onOpenChat: () => void;
}

export function FYIItem({ item, onOpenChat }: FYIItemProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <button
      onClick={onOpenChat}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-colors",
        "hover:bg-muted/50 hover:border-blue-500/30",
        "border-blue-500/10 bg-blue-500/5"
      )}
    >
      <div className="flex items-start gap-3">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium text-sm truncate">{item.chatTitle}</h4>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatDate(item.lastMessageDate)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
            {item.summary}
          </p>
        </div>
        {item.unreadCount > 0 && (
          <span className="text-xs bg-blue-500/20 text-blue-600 px-1.5 py-0.5 rounded shrink-0">
            {item.unreadCount}
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </button>
  );
}

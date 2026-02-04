interface FYIItemData {
  id: number;
  chat_id: number;
  chat_name: string;
  chat_type: "dm" | "group" | "channel";
  unread_count: number;
  last_message: string | null;
  last_message_date: string | null;
  priority: "fyi";
  summary: string;
}

interface FYIItemProps {
  item: FYIItemData;
  onOpenChat: () => void;
}

export function FYIItem({ item, onOpenChat }: FYIItemProps) {
  return (
    <button
      onClick={onOpenChat}
      className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors grid grid-cols-[1fr_auto_2fr] gap-4 items-center"
    >
      {/* Name (Left) */}
      <div className="truncate">
        <span className="font-medium">{item.chat_name}</span>
      </div>

      {/* Count (Center) */}
      <div className="text-center">
        <span className="text-sm bg-sky-100/50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200/50 dark:border-sky-800/40 px-2 py-0.5 rounded-full">
          {item.unread_count}
        </span>
      </div>

      {/* Summary (Right) */}
      <div className="truncate text-sm text-muted-foreground">
        {item.summary || "No action needed"}
      </div>
    </button>
  );
}

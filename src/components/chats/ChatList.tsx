import { VirtualList } from "@/components/common/VirtualList";
import { SearchInput } from "@/components/common/SearchInput";
import { ChatItem } from "./ChatItem";
import { Button } from "@/components/ui/button";
import type { Chat } from "@/types/telegram";
import { useState, useMemo } from "react";
import { Loader2, MessageSquare, Users, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatTypeFilter = "all" | "private" | "group" | "channel";

interface ChatListProps {
  chats: Chat[];
  selectedChatId: number | null;
  onSelectChat: (chatId: number) => void;
  isLoading: boolean;
}

const typeFilters: { value: ChatTypeFilter; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All", icon: null },
  { value: "private", label: "DMs", icon: <MessageSquare className="h-3 w-3" /> },
  { value: "group", label: "Groups", icon: <Users className="h-3 w-3" /> },
  { value: "channel", label: "Channels", icon: <Radio className="h-3 w-3" /> },
];

export function ChatList({
  chats,
  selectedChatId,
  onSelectChat,
  isLoading,
}: ChatListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ChatTypeFilter>("all");

  const filteredChats = useMemo(() => {
    let result = chats;

    // Apply type filter
    if (typeFilter !== "all") {
      result = result.filter((chat) => chat.type === typeFilter);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((chat) =>
        chat.title.toLowerCase().includes(query)
      );
    }

    return result;
  }, [chats, searchQuery, typeFilter]);

  const chatCounts = useMemo(() => {
    return {
      all: chats.length,
      private: chats.filter((c) => c.type === "private").length,
      group: chats.filter((c) => c.type === "group").length,
      channel: chats.filter((c) => c.type === "channel").length,
    };
  }, [chats]);

  if (isLoading && chats.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Chats</h2>
          <span className="text-sm text-muted-foreground">
            {filteredChats.length} of {chats.length}
          </span>
        </div>

        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search chats..."
        />

        {/* Type Filter */}
        <div className="flex items-center gap-1">
          {typeFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={typeFilter === filter.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setTypeFilter(filter.value)}
              className={cn(
                "text-xs h-7 px-2",
                typeFilter === filter.value && "bg-primary text-primary-foreground"
              )}
            >
              {filter.icon}
              <span className={filter.icon ? "ml-1" : ""}>
                {filter.label}
              </span>
              <span className="ml-1 text-xs opacity-70">
                ({chatCounts[filter.value]})
              </span>
            </Button>
          ))}
        </div>
      </div>

      {filteredChats.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          {searchQuery || typeFilter !== "all"
            ? "No chats found"
            : "No chats yet"}
        </div>
      ) : (
        <VirtualList
          items={filteredChats}
          estimateSize={72}
          className="flex-1"
          renderItem={(chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isSelected={chat.id === selectedChatId}
              onClick={() => onSelectChat(chat.id)}
            />
          )}
        />
      )}
    </div>
  );
}

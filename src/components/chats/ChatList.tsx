import { VirtualList } from "@/components/common/VirtualList";
import { SearchInput } from "@/components/common/SearchInput";
import { ChatItem } from "./ChatItem";
import type { Chat } from "@/types/telegram";
import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";

interface ChatListProps {
  chats: Chat[];
  selectedChatId: number | null;
  onSelectChat: (chatId: number) => void;
  isLoading: boolean;
}

export function ChatList({
  chats,
  selectedChatId,
  onSelectChat,
  isLoading,
}: ChatListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChats = useMemo(() => {
    if (!searchQuery) return chats;
    const query = searchQuery.toLowerCase();
    return chats.filter((chat) =>
      chat.title.toLowerCase().includes(query)
    );
  }, [chats, searchQuery]);

  if (isLoading && chats.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search chats..."
        />
      </div>

      {filteredChats.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          {searchQuery ? "No chats found" : "No chats yet"}
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

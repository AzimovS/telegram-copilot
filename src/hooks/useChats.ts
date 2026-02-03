import { useEffect, useCallback, useState } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { chatFiltersFromSettings, getFolders } from "@/lib/tauri";
import type { Folder } from "@/types/telegram";

export function useChats() {
  const {
    chats,
    selectedChatId,
    messages,
    isLoadingChats,
    isLoadingMessages,
    error,
    loadChats,
    selectChat,
    loadMessages,
    sendMessage,
    clearError,
  } = useChatStore();

  const chatFilters = useSettingsStore((state) => state.chatFilters);
  const [folders, setFolders] = useState<Folder[]>([]);

  // Load folders when component mounts or when selectedFolderIds changes
  useEffect(() => {
    // Only load folders if we have selected folder IDs
    if (chatFilters.selectedFolderIds.length > 0) {
      getFolders()
        .then(setFolders)
        .catch((err) => console.error("Failed to load folders:", err));
    } else {
      setFolders([]);
    }
  }, [chatFilters.selectedFolderIds.length]);

  // Load chats on mount and when filters or folders change
  useEffect(() => {
    const filters = chatFiltersFromSettings(chatFilters, folders);
    loadChats(50, filters);
  }, [loadChats, chatFilters, folders]);

  // Get messages for selected chat
  const selectedChatMessages = selectedChatId
    ? messages[selectedChatId] || []
    : [];

  // Get selected chat
  const selectedChat = chats.find((c) => c.id === selectedChatId) || null;

  // Load more messages
  const loadMoreMessages = useCallback(() => {
    if (selectedChatId && selectedChatMessages.length > 0) {
      const oldestMessage = selectedChatMessages[selectedChatMessages.length - 1];
      loadMessages(selectedChatId, 50, oldestMessage.id);
    }
  }, [selectedChatId, selectedChatMessages, loadMessages]);

  // Send message to selected chat
  const sendToSelectedChat = useCallback(
    async (text: string) => {
      if (selectedChatId) {
        await sendMessage(selectedChatId, text);
      }
    },
    [selectedChatId, sendMessage]
  );

  // Refresh with current filters
  const refresh = useCallback(() => {
    const filters = chatFiltersFromSettings(chatFilters, folders);
    loadChats(50, filters);
  }, [loadChats, chatFilters, folders]);

  return {
    chats,
    selectedChat,
    selectedChatId,
    selectedChatMessages,
    isLoadingChats,
    isLoadingMessages,
    error,
    selectChat,
    loadMoreMessages,
    sendMessage: sendToSelectedChat,
    refresh,
    clearError,
  };
}

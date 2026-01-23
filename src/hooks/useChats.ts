import { useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chatStore";

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

  // Load chats on mount
  useEffect(() => {
    loadChats();
  }, [loadChats]);

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
    refresh: loadChats,
    clearError,
  };
}

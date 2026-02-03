import { useEffect, useCallback, useState, useRef } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { chatFiltersFromSettings, getFolders } from "@/lib/tauri";
import type { Folder } from "@/types/telegram";

const DEBOUNCE_MS = 300;

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
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const isInitialMount = useRef(true);

  // Clear chats immediately on mount to prevent showing stale data
  useEffect(() => {
    useChatStore.setState({ chats: [], isLoadingChats: true });
  }, []);

  // Load folders when component mounts or when selectedFolderIds changes
  useEffect(() => {
    let cancelled = false;
    setFoldersLoaded(false);

    // Only load folders if we have selected folder IDs
    if (chatFilters.selectedFolderIds.length > 0) {
      getFolders()
        .then((f) => {
          if (!cancelled) {
            setFolders(f);
            setFoldersLoaded(true);
          }
        })
        .catch((err) => {
          console.error("Failed to load folders:", err);
          if (!cancelled) setFoldersLoaded(true);
        });
    } else {
      setFolders([]);
      setFoldersLoaded(true);
    }

    return () => {
      cancelled = true;
    };
  }, [chatFilters.selectedFolderIds]);

  // Load chats on mount and when filters or folders change (with debouncing)
  useEffect(() => {
    // Wait for folders to be loaded before fetching chats
    if (!foldersLoaded) return;

    // Skip debounce on initial mount for faster first load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const filters = chatFiltersFromSettings(chatFilters, folders);
      loadChats(50, filters);
      return;
    }

    // Debounce subsequent filter changes
    const timeoutId = setTimeout(() => {
      const filters = chatFiltersFromSettings(chatFilters, folders);
      loadChats(50, filters);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadChats, chatFilters, folders, foldersLoaded]);

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

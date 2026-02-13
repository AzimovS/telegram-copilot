import { useEffect, useCallback, useState, useRef } from "react";
import { useChatStore, DEFAULT_CHAT_LIMIT } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { chatFiltersFromSettings, getFolders } from "@/lib/tauri";
import type { Folder } from "@/types/telegram";

const DEBOUNCE_MS = 300;
const CACHE_TTL_MINUTES = 2; // Cache chats for 2 minutes

export function useChats() {
  const {
    chats,
    selectedChatId,
    messages,
    isLoadingChats,
    isLoadingMoreChats,
    isLoadingMessages,
    hasMoreChats,
    error,
    loadChats,
    loadMoreChats,
    selectChat,
    loadMessages,
    sendMessage,
    clearError,
    shouldRefreshChats,
  } = useChatStore();

  const chatFilters = useSettingsStore((state) => state.chatFilters);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const lastFiltersHash = useRef<string | null>(null);

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

    const filters = chatFiltersFromSettings(chatFilters, folders);
    const currentFiltersHash = JSON.stringify(filters);

    // Check if we need to refresh (cache expired or filters changed)
    const filtersChanged = lastFiltersHash.current !== currentFiltersHash;
    const needsRefresh = shouldRefreshChats(CACHE_TTL_MINUTES, currentFiltersHash);

    // If we have cached chats and don't need refresh, skip loading
    if (!needsRefresh && !filtersChanged && chats.length > 0) {
      lastFiltersHash.current = currentFiltersHash;
      return;
    }

    // If filters changed, load immediately without debounce
    if (filtersChanged || chats.length === 0) {
      lastFiltersHash.current = currentFiltersHash;
      loadChats(DEFAULT_CHAT_LIMIT, filters);
      return;
    }

    // Debounce background refresh
    const timeoutId = setTimeout(() => {
      lastFiltersHash.current = currentFiltersHash;
      loadChats(DEFAULT_CHAT_LIMIT, filters);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadChats, chatFilters, folders, foldersLoaded, shouldRefreshChats, chats.length]);

  // Get messages for selected chat
  const selectedChatMessages = selectedChatId
    ? messages[selectedChatId] || []
    : [];

  // Get selected chat
  const selectedChat = chats.find((c) => c.id === selectedChatId) || null;

  // Load more messages (messages are sorted oldest-first, so index 0 is the oldest)
  const loadMoreMessages = useCallback(() => {
    if (selectedChatId && selectedChatMessages.length > 0) {
      const oldestMessage = selectedChatMessages[0];
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

  // Refresh with current filters (force refresh)
  const refresh = useCallback(() => {
    const filters = chatFiltersFromSettings(chatFilters, folders);
    loadChats(DEFAULT_CHAT_LIMIT, filters, true);
  }, [loadChats, chatFilters, folders]);

  // Load more chats (pagination)
  const loadMore = useCallback(() => {
    const filters = chatFiltersFromSettings(chatFilters, folders);
    loadMoreChats(filters);
  }, [loadMoreChats, chatFilters, folders]);

  return {
    chats,
    selectedChat,
    selectedChatId,
    selectedChatMessages,
    isLoadingChats,
    isLoadingMoreChats,
    isLoadingMessages,
    hasMoreChats,
    error,
    selectChat,
    loadMoreMessages,
    loadMoreChats: loadMore,
    sendMessage: sendToSelectedChat,
    refresh,
    clearError,
  };
}

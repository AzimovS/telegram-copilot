import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import type { AuthState, Chat, Message } from "@/types/telegram";

export function useTelegramEvents() {
  const { setAuthState } = useAuthStore();
  const { addMessage } = useChatStore();

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    // Listen for auth state changes
    listen<AuthState>("telegram://auth-state", (event) => {
      setAuthState(event.payload);
    }).then((unlisten) => unlisteners.push(unlisten));

    // Listen for new messages
    listen<Message>("telegram://new-message", (event) => {
      addMessage(event.payload);
    }).then((unlisten) => unlisteners.push(unlisten));

    // Listen for chat updates
    listen<Chat>("telegram://chat-updated", (event) => {
      // Update chat in store
      console.log("Chat updated:", event.payload);
    }).then((unlisten) => unlisteners.push(unlisten));

    // Listen for errors
    listen<string>("telegram://error", (event) => {
      console.error("Telegram error:", event.payload);
    }).then((unlisten) => unlisteners.push(unlisten));

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [setAuthState, addMessage]);
}

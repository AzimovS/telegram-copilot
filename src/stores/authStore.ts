import { create } from "zustand";
import type { AuthState, User } from "@/types/telegram";
import * as tauri from "@/lib/tauri";

interface AuthStore {
  authState: AuthState;
  currentUser: User | null;
  isLoading: boolean;
  isConnecting: boolean;
  error: string | null;

  // Actions
  setAuthState: (state: AuthState) => void;
  setCurrentUser: (user: User | null) => void;
  connect: () => Promise<void>;
  sendPhoneNumber: (phoneNumber: string) => Promise<void>;
  sendAuthCode: (code: string) => Promise<void>;
  sendPassword: (password: string) => Promise<void>;
  checkAuthState: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  authState: { type: "waitPhoneNumber" },
  currentUser: null,
  isLoading: false,
  isConnecting: true,
  error: null,

  setAuthState: (authState) => set({ authState }),
  setCurrentUser: (currentUser) => set({ currentUser }),

  connect: async () => {
    set({ isConnecting: true, error: null });
    try {
      const isAuthorized = await tauri.connect();
      if (isAuthorized) {
        const user = await tauri.getCurrentUser();
        set({ currentUser: user, authState: { type: "ready" } });
      } else {
        set({ authState: { type: "waitPhoneNumber" } });
      }
    } catch (error) {
      console.error("Failed to connect:", error);
      set({ error: String(error) });
    } finally {
      set({ isConnecting: false });
    }
  },

  sendPhoneNumber: async (phoneNumber) => {
    set({ isLoading: true, error: null });
    try {
      await tauri.sendPhoneNumber(phoneNumber);
      set({ authState: { type: "waitCode", phoneNumber } });
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  sendAuthCode: async (code) => {
    set({ isLoading: true, error: null });
    try {
      await tauri.sendAuthCode(code);
      // If successful, we'll get a ready state via event
      const user = await tauri.getCurrentUser();
      set({ currentUser: user, authState: { type: "ready" } });
    } catch (error) {
      const errorStr = String(error);
      // Check if this is a 2FA required error (not a real error)
      if (errorStr.includes("2FA required")) {
        // Extract hint from error message
        const hintMatch = errorStr.match(/Hint: (.*)$/);
        const hint = hintMatch ? hintMatch[1] : "";
        set({ authState: { type: "waitPassword", hint }, error: null });
      } else if (errorStr.includes("No login token")) {
        // Session expired - reset to phone input with user-friendly message
        set({
          authState: { type: "waitPhoneNumber" },
          error: "Session expired. Please enter your phone number again."
        });
      } else {
        set({ error: errorStr });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  sendPassword: async (password) => {
    set({ isLoading: true, error: null });
    try {
      await tauri.sendPassword(password);
      const user = await tauri.getCurrentUser();
      set({ currentUser: user, authState: { type: "ready" } });
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  checkAuthState: async () => {
    try {
      const state = await tauri.getAuthState();
      set({ authState: state });

      if (state.type === "ready") {
        const user = await tauri.getCurrentUser();
        set({ currentUser: user });
      }
    } catch (error) {
      console.error("Failed to check auth state:", error);
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await tauri.logout();
      set({
        authState: { type: "waitPhoneNumber" },
        currentUser: null,
      });
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

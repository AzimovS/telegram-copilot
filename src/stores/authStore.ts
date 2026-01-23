import { create } from "zustand";
import type { AuthState, User } from "@/types/telegram";
import * as tauri from "@/lib/tauri";

interface AuthStore {
  authState: AuthState;
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setAuthState: (state: AuthState) => void;
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
  error: null,

  setAuthState: (authState) => set({ authState }),

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
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  sendPassword: async (password) => {
    set({ isLoading: true, error: null });
    try {
      await tauri.sendPassword(password);
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  checkAuthState: async () => {
    try {
      const stateStr = await tauri.getAuthState();
      const state = JSON.parse(stateStr) as AuthState;
      set({ authState: state });
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

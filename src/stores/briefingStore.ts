import { create } from "zustand";
import type { BriefingV2Response } from "@/lib/tauri";

interface BriefingStore {
  data: BriefingV2Response | null;
  isLoading: boolean;
  error: string | null;
  lastLoadedAt: number | null;

  // Actions
  setData: (data: BriefingV2Response) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  removeItem: (chatId: number) => void;
  clear: () => void;

  // Helpers
  shouldRefresh: (ttlMinutes: number) => boolean;
}

export const useBriefingStore = create<BriefingStore>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  lastLoadedAt: null,

  setData: (data) => {
    set({
      data,
      lastLoadedAt: Date.now(),
      error: null,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  removeItem: (chatId) => {
    set((state) => {
      if (!state.data) return state;
      return {
        data: {
          ...state.data,
          needs_response: state.data.needs_response.filter(
            (item) => item.chat_id !== chatId
          ),
        },
      };
    });
  },

  clear: () => set({ data: null, lastLoadedAt: null, error: null }),

  shouldRefresh: (ttlMinutes) => {
    const { lastLoadedAt, data } = get();
    if (!data || !lastLoadedAt) return true;
    const ageMs = Date.now() - lastLoadedAt;
    const ttlMs = ttlMinutes * 60 * 1000;
    return ageMs >= ttlMs;
  },
}));

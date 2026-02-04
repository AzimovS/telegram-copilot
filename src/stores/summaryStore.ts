import { create } from "zustand";
import type { ChatSummary } from "@/components/summary/types";

interface SummaryStore {
  summaries: ChatSummary[];
  isLoading: boolean;
  error: string | null;
  lastLoadedAt: number | null;
  isCached: boolean;
  cacheAge: string | null;

  // Pagination state
  offset: number;
  hasMore: boolean;
  isLoadingMore: boolean;

  // Filter state (to detect when filters change)
  filterHash: string | null;

  // Actions
  setSummaries: (summaries: ChatSummary[], append?: boolean) => void;
  setLoading: (loading: boolean) => void;
  setLoadingMore: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCacheInfo: (cached: boolean, age: string | null) => void;
  setHasMore: (hasMore: boolean) => void;
  setOffset: (offset: number) => void;
  setFilterHash: (hash: string) => void;
  updateSummary: (chatId: number, summary: Partial<ChatSummary>) => void;
  clear: () => void;

  // Helpers
  shouldRefresh: (ttlMinutes: number, currentFilterHash: string) => boolean;
}

export const useSummaryStore = create<SummaryStore>((set, get) => ({
  summaries: [],
  isLoading: false,
  error: null,
  lastLoadedAt: null,
  isCached: false,
  cacheAge: null,
  offset: 0,
  hasMore: false,
  isLoadingMore: false,
  filterHash: null,

  setSummaries: (summaries, append = false) => {
    set((state) => ({
      summaries: append ? [...state.summaries, ...summaries] : summaries,
      lastLoadedAt: Date.now(),
      error: null,
    }));
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setLoadingMore: (loading) => set({ isLoadingMore: loading }),

  setError: (error) => set({ error }),

  setCacheInfo: (cached, age) => set({ isCached: cached, cacheAge: age }),

  setHasMore: (hasMore) => set({ hasMore }),

  setOffset: (offset) => set({ offset }),

  setFilterHash: (hash) => set({ filterHash: hash }),

  updateSummary: (chatId, updates) => {
    set((state) => ({
      summaries: state.summaries.map((s) =>
        s.chatId === chatId ? { ...s, ...updates } : s
      ),
    }));
  },

  clear: () =>
    set({
      summaries: [],
      lastLoadedAt: null,
      error: null,
      offset: 0,
      hasMore: false,
      isCached: false,
      cacheAge: null,
      filterHash: null,
    }),

  shouldRefresh: (ttlMinutes, currentFilterHash) => {
    const { lastLoadedAt, summaries, filterHash } = get();
    // Refresh if no data, filters changed, or TTL expired
    if (!summaries.length || !lastLoadedAt) return true;
    if (filterHash !== currentFilterHash) return true;
    const ageMs = Date.now() - lastLoadedAt;
    const ttlMs = ttlMinutes * 60 * 1000;
    return ageMs >= ttlMs;
  },
}));

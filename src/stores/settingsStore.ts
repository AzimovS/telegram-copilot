import { create } from "zustand";
import { persist } from "zustand/middleware";

// Initial default tags (shipped with the app)
const INITIAL_DEFAULT_TAGS = [
  "investor",
  "builder",
  "enterprise",
  "community",
  "personal",
  "colleague",
  "candidate",
  "defi",
  "founder",
];

// Chat filter settings for global chat filtering
export interface ChatFilterSettings {
  includePrivateChats: boolean;
  includeNonContacts: boolean; // Filter non-contact DMs (only applies when includePrivateChats is true)
  includeGroups: boolean;
  includeChannels: boolean;
  includeBots: boolean;
  includeArchived: boolean;
  includeMuted: boolean;
  // null = no limit, [min, max] = member count range (1001 = no upper limit)
  groupSizeRange: [number, number] | null;
  // empty array = no folder filtering (show all chats)
  selectedFolderIds: number[];
}

const DEFAULT_CHAT_FILTERS: ChatFilterSettings = {
  includePrivateChats: true,
  includeNonContacts: true,
  includeGroups: true,
  includeChannels: true,
  includeBots: false,
  includeArchived: false,
  includeMuted: false,
  groupSizeRange: null,
  selectedFolderIds: [],
};

interface SettingsStore {
  defaultTags: string[];
  chatFilters: ChatFilterSettings;
  onboardingCompleted: boolean;
  addDefaultTag: (tag: string) => void;
  removeDefaultTag: (tag: string) => void;
  resetDefaultTags: () => void;
  setChatFilters: (filters: Partial<ChatFilterSettings>) => void;
  resetChatFilters: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      defaultTags: INITIAL_DEFAULT_TAGS,
      chatFilters: DEFAULT_CHAT_FILTERS,
      onboardingCompleted: false,

      addDefaultTag: (tag) => {
        const trimmedTag = tag.trim().toLowerCase();
        if (!trimmedTag) return;

        set((state) => ({
          defaultTags: state.defaultTags.includes(trimmedTag)
            ? state.defaultTags
            : [...state.defaultTags, trimmedTag].sort(),
        }));
      },

      removeDefaultTag: (tag) => {
        set((state) => ({
          defaultTags: state.defaultTags.filter((t) => t !== tag),
        }));
      },

      resetDefaultTags: () => {
        set({ defaultTags: INITIAL_DEFAULT_TAGS });
      },

      setChatFilters: (filters) => {
        set((state) => ({
          chatFilters: { ...state.chatFilters, ...filters },
        }));
      },

      resetChatFilters: () => {
        set({ chatFilters: DEFAULT_CHAT_FILTERS });
      },

      completeOnboarding: () => {
        set({ onboardingCompleted: true });
      },

      resetOnboarding: () => {
        set({ onboardingCompleted: false });
      },
    }),
    {
      name: "settings-storage",
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as SettingsStore;

        if (version === 0) {
          // Migrate from old format with includeLargeGroups to maxGroupSize (v0 → v1)
          const oldFilters = state.chatFilters as ChatFilterSettings & {
            includeLargeGroups?: boolean;
            largeGroupThreshold?: number;
          };

          let maxGroupSize: number | null = null;
          if (oldFilters.includeLargeGroups === false) {
            maxGroupSize = oldFilters.largeGroupThreshold ?? 500;
          }

          // Then convert to v2 format
          return {
            ...state,
            chatFilters: {
              includePrivateChats: oldFilters.includePrivateChats ?? true,
              includeNonContacts: true,
              includeGroups: oldFilters.includeGroups ?? true,
              includeChannels: oldFilters.includeChannels ?? true,
              includeBots: oldFilters.includeBots ?? false,
              includeArchived: oldFilters.includeArchived ?? false,
              includeMuted: oldFilters.includeMuted ?? false,
              groupSizeRange: maxGroupSize !== null ? [0, maxGroupSize] : null,
              selectedFolderIds: [],
            },
          };
        }

        if (version === 1) {
          // Migrate from v1 (maxGroupSize) to v2 (groupSizeRange)
          const oldFilters = state.chatFilters as ChatFilterSettings & {
            maxGroupSize?: number | null;
          };

          // Convert maxGroupSize: N → groupSizeRange: [0, N]
          const groupSizeRange: [number, number] | null =
            oldFilters.maxGroupSize !== null && oldFilters.maxGroupSize !== undefined
              ? [0, oldFilters.maxGroupSize]
              : null;

          return {
            ...state,
            chatFilters: {
              includePrivateChats: oldFilters.includePrivateChats ?? true,
              includeNonContacts: true,
              includeGroups: oldFilters.includeGroups ?? true,
              includeChannels: oldFilters.includeChannels ?? true,
              includeBots: oldFilters.includeBots ?? false,
              includeArchived: oldFilters.includeArchived ?? false,
              includeMuted: oldFilters.includeMuted ?? false,
              groupSizeRange,
              selectedFolderIds: oldFilters.selectedFolderIds ?? [],
            },
          };
        }

        return state;
      },
    }
  )
);

// Export for use in other stores
export const getDefaultTags = () => useSettingsStore.getState().defaultTags;
export const getChatFilters = () => useSettingsStore.getState().chatFilters;

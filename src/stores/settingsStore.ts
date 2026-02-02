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

interface SettingsStore {
  defaultTags: string[];
  addDefaultTag: (tag: string) => void;
  removeDefaultTag: (tag: string) => void;
  resetDefaultTags: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      defaultTags: INITIAL_DEFAULT_TAGS,

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
    }),
    {
      name: "settings-storage",
    }
  )
);

// Export for use in other stores
export const getDefaultTags = () => useSettingsStore.getState().defaultTags;

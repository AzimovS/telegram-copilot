import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "night-accent" | "dark";

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: "light",
      setTheme: (theme) => {
        // Update document class for CSS theming
        const root = document.documentElement;
        root.classList.remove("light", "night-accent", "dark");
        root.classList.add(theme);
        set({ theme });
      },
    }),
    {
      name: "theme-storage",
      onRehydrateStorage: () => (state) => {
        // Apply theme on rehydration
        if (state?.theme) {
          const root = document.documentElement;
          root.classList.remove("light", "night-accent", "dark");
          root.classList.add(state.theme);
        }
      },
    }
  )
);

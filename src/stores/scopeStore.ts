import { create } from "zustand";
import type { Folder, ChatType } from "@/types/telegram";
import type { ScopeProfile, ScopeConfig, ActiveScope } from "@/types/scope";
import * as tauri from "@/lib/tauri";

interface ScopeStore {
  folders: Folder[];
  profiles: ScopeProfile[];
  activeScope: ActiveScope;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadFolders: () => Promise<void>;
  loadProfiles: () => Promise<void>;
  selectProfile: (profile: ScopeProfile | null) => void;
  setCustomConfig: (config: ScopeConfig) => void;
  saveProfile: (name: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  toggleFolder: (folderId: number) => void;
  toggleChatType: (chatType: ChatType) => void;
  excludeChat: (chatId: number) => void;
  includeChat: (chatId: number) => void;
  clearError: () => void;
  reset: () => void;

  // Computed
  getCurrentConfig: () => ScopeConfig;
}

const defaultConfig: ScopeConfig = {
  folderIds: [],
  chatTypes: ["private", "group", "supergroup", "channel"],
  excludedChatIds: [],
  includedChatIds: [],
};

export const useScopeStore = create<ScopeStore>((set, get) => ({
  folders: [],
  profiles: [],
  activeScope: { profile: null, customConfig: null },
  isLoading: false,
  error: null,

  loadFolders: async () => {
    set({ isLoading: true, error: null });
    try {
      const folders = (await tauri.getFolders()) as Folder[];
      set({ folders });
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  loadProfiles: async () => {
    try {
      const names = await tauri.listScopes();
      const profiles: ScopeProfile[] = [];
      for (const name of names) {
        const profile = (await tauri.loadScope(name)) as ScopeProfile;
        profiles.push(profile);
      }
      set({ profiles });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  selectProfile: (profile) => {
    set({
      activeScope: { profile, customConfig: null },
    });
  },

  setCustomConfig: (config) => {
    set({
      activeScope: { profile: null, customConfig: config },
    });
  },

  saveProfile: async (name) => {
    const config = get().getCurrentConfig();
    const profile: ScopeProfile = {
      id: crypto.randomUUID(),
      name,
      ...config,
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    try {
      await tauri.saveScope(name, profile);
      set((state) => ({
        profiles: [...state.profiles, profile],
        activeScope: { profile, customConfig: null },
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  deleteProfile: async (id) => {
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== id),
      activeScope:
        state.activeScope.profile?.id === id
          ? { profile: null, customConfig: null }
          : state.activeScope,
    }));
  },

  toggleFolder: (folderId) => {
    const config = get().getCurrentConfig();
    const folderIds = config.folderIds.includes(folderId)
      ? config.folderIds.filter((id) => id !== folderId)
      : [...config.folderIds, folderId];
    set({
      activeScope: {
        profile: null,
        customConfig: { ...config, folderIds },
      },
    });
  },

  toggleChatType: (chatType) => {
    const config = get().getCurrentConfig();
    const chatTypes = config.chatTypes.includes(chatType)
      ? config.chatTypes.filter((t) => t !== chatType)
      : [...config.chatTypes, chatType];
    set({
      activeScope: {
        profile: null,
        customConfig: { ...config, chatTypes },
      },
    });
  },

  excludeChat: (chatId) => {
    const config = get().getCurrentConfig();
    if (!config.excludedChatIds.includes(chatId)) {
      set({
        activeScope: {
          profile: null,
          customConfig: {
            ...config,
            excludedChatIds: [...config.excludedChatIds, chatId],
            includedChatIds: config.includedChatIds.filter(
              (id) => id !== chatId
            ),
          },
        },
      });
    }
  },

  includeChat: (chatId) => {
    const config = get().getCurrentConfig();
    if (!config.includedChatIds.includes(chatId)) {
      set({
        activeScope: {
          profile: null,
          customConfig: {
            ...config,
            includedChatIds: [...config.includedChatIds, chatId],
            excludedChatIds: config.excludedChatIds.filter(
              (id) => id !== chatId
            ),
          },
        },
      });
    }
  },

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      folders: [],
      profiles: [],
      activeScope: { profile: null, customConfig: null },
      isLoading: false,
      error: null,
    }),

  getCurrentConfig: () => {
    const { activeScope } = get();
    if (activeScope.profile) {
      return {
        folderIds: activeScope.profile.folderIds,
        chatTypes: activeScope.profile.chatTypes,
        excludedChatIds: activeScope.profile.excludedChatIds,
        includedChatIds: activeScope.profile.includedChatIds,
      };
    }
    return activeScope.customConfig || defaultConfig;
  },
}));

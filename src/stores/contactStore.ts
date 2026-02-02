import { create } from "zustand";
import type {
  Contact,
  ContactFilters,
  ContactSortField,
  ContactSortOption,
  SortDirection,
} from "@/types/contacts";
import * as tauri from "@/lib/tauri";
import { getDefaultTags } from "./settingsStore";

interface ContactStore {
  contacts: Contact[];
  selectedContactId: number | null;
  selectedIds: number[]; // Bulk selection
  filters: ContactFilters;
  sortField: ContactSortField;
  sortDirection: SortDirection;
  sortOption: ContactSortOption; // Simplified sort for new UI
  allTags: string[];
  isLoading: boolean;
  isRefreshing: boolean;
  isDeleting: boolean;
  error: string | null;
  warning: string | null;
  cached: boolean;
  cacheAge: string | null;

  // Actions
  loadContacts: (forceRefresh?: boolean) => Promise<void>;
  selectContact: (userId: number | null) => void;
  toggleSelectId: (userId: number) => void;
  selectAllFiltered: (filteredIds: number[]) => void;
  clearSelection: () => void;
  addTag: (userId: number, tag: string) => Promise<void>;
  removeTag: (userId: number, tag: string) => Promise<void>;
  bulkAddTag: (userIds: number[], tag: string) => Promise<void>;
  deleteContacts: (userIds: number[]) => Promise<boolean>;
  updateNotes: (userId: number, notes: string) => Promise<void>;
  setFilters: (filters: Partial<ContactFilters>) => void;
  setSorting: (field: ContactSortField, direction: SortDirection) => void;
  setSortOption: (option: ContactSortOption) => void;
  clearError: () => void;
  clearWarning: () => void;

  // Computed
  getFilteredContacts: () => Contact[];
  getNeverContactedCount: () => number;
}

const defaultFilters: ContactFilters = {
  searchQuery: "",
  tags: [],
  selectedTag: null,
  hasNotes: null,
  minDaysSinceContact: null,
  maxDaysSinceContact: null,
};


export const useContactStore = create<ContactStore>((set, get) => ({
  contacts: [],
  selectedContactId: null,
  selectedIds: [],
  filters: defaultFilters,
  sortField: "lastContact",
  sortDirection: "desc",
  sortOption: "recent",
  allTags: [],
  isLoading: false,
  isRefreshing: false,
  isDeleting: false,
  error: null,
  warning: null,
  cached: false,
  cacheAge: null,

  loadContacts: async (forceRefresh = false) => {
    if (forceRefresh) {
      set({ isRefreshing: true });
    } else {
      set({ isLoading: true });
    }
    set({ error: null });

    try {
      // Fetch contacts and chats in parallel
      const [rawContacts, chats] = await Promise.all([
        tauri.getContacts() as Promise<Contact[]>,
        tauri.getChats(200), // Get enough chats to match with contacts
      ]);

      // Create a map of user ID to chat data for private chats
      const chatByUserId = new Map<number, { lastMessageDate: number; unreadCount: number }>();
      for (const chat of chats) {
        // Private chats have the same ID as the user ID
        if (chat.type === "private" && chat.lastMessage) {
          chatByUserId.set(chat.id, {
            lastMessageDate: chat.lastMessage.date,
            unreadCount: chat.unreadCount,
          });
        }
      }

      // Enrich contacts with chat data
      const now = Math.floor(Date.now() / 1000);
      const contacts = rawContacts.map((contact) => {
        const chatData = chatByUserId.get(contact.userId);
        if (chatData) {
          const daysSinceContact = Math.floor((now - chatData.lastMessageDate) / 86400);
          return {
            ...contact,
            lastContactDate: chatData.lastMessageDate,
            daysSinceContact,
            unreadCount: chatData.unreadCount,
          };
        }
        return contact;
      });

      // Merge default tags (from settings) with tags from contacts
      const contactTags = contacts.flatMap((c) => c.tags);
      const defaultTags = getDefaultTags();
      const allTags = [...new Set([...defaultTags, ...contactTags])].sort();

      // For now, we don't have cache info from tauri, set as fresh
      set({
        contacts,
        allTags,
        cached: false,
        cacheAge: null,
      });
    } catch (error) {
      const errorStr = String(error);
      // Check if it's a rate limit error
      if (errorStr.includes("rate") || errorStr.includes("limit")) {
        set({
          warning: "Rate limited. Using cached data. Try refresh in a few minutes.",
        });
      } else {
        set({ error: errorStr });
      }
    } finally {
      set({ isLoading: false, isRefreshing: false });
    }
  },

  selectContact: (userId) => set({ selectedContactId: userId }),

  toggleSelectId: (userId) => {
    set((state) => {
      const isSelected = state.selectedIds.includes(userId);
      return {
        selectedIds: isSelected
          ? state.selectedIds.filter((id) => id !== userId)
          : [...state.selectedIds, userId],
      };
    });
  },

  selectAllFiltered: (filteredIds) => {
    set((state) => {
      const allSelected = filteredIds.every((id) => state.selectedIds.includes(id));
      return {
        selectedIds: allSelected ? [] : filteredIds,
      };
    });
  },

  clearSelection: () => set({ selectedIds: [] }),

  addTag: async (userId, tag) => {
    try {
      await tauri.addContactTag(userId, tag);
      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.userId === userId
            ? { ...c, tags: [...c.tags, tag] }
            : c
        ),
        allTags: state.allTags.includes(tag)
          ? state.allTags
          : [...state.allTags, tag].sort(),
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  removeTag: async (userId, tag) => {
    try {
      await tauri.removeContactTag(userId, tag);
      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.userId === userId
            ? { ...c, tags: c.tags.filter((t) => t !== tag) }
            : c
        ),
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  bulkAddTag: async (userIds, tag) => {
    try {
      // Apply tag to all selected contacts
      for (const userId of userIds) {
        await tauri.addContactTag(userId, tag);
      }
      set((state) => ({
        contacts: state.contacts.map((c) =>
          userIds.includes(c.userId) && !c.tags.includes(tag)
            ? { ...c, tags: [...c.tags, tag] }
            : c
        ),
        allTags: state.allTags.includes(tag)
          ? state.allTags
          : [...state.allTags, tag].sort(),
        selectedIds: [], // Clear selection after bulk operation
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  deleteContacts: async (userIds) => {
    set({ isDeleting: true });
    try {
      // Note: This requires a tauri command to delete contacts
      // For now, we'll just remove them from local state
      // await tauri.deleteContacts(userIds);

      set((state) => ({
        contacts: state.contacts.filter((c) => !userIds.includes(c.userId)),
        selectedIds: [],
        selectedContactId: userIds.includes(state.selectedContactId || 0)
          ? null
          : state.selectedContactId,
      }));
      return true;
    } catch (error) {
      set({ error: String(error) });
      return false;
    } finally {
      set({ isDeleting: false });
    }
  },

  updateNotes: async (userId, notes) => {
    try {
      await tauri.updateContactNotes(userId, notes);
      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.userId === userId ? { ...c, notes } : c
        ),
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  setSorting: (field, direction) =>
    set({ sortField: field, sortDirection: direction }),

  setSortOption: (option) => {
    // Map simplified sort option to field/direction
    let field: ContactSortField;
    let direction: SortDirection;

    switch (option) {
      case "recent":
        field = "lastContact";
        direction = "desc";
        break;
      case "name":
        field = "name";
        direction = "asc";
        break;
      case "unread":
        field = "unread";
        direction = "desc";
        break;
      default:
        field = "lastContact";
        direction = "desc";
    }

    set({ sortOption: option, sortField: field, sortDirection: direction });
  },

  clearError: () => set({ error: null }),
  clearWarning: () => set({ warning: null }),

  getFilteredContacts: () => {
    const { contacts, filters, sortField, sortDirection } = get();

    let filtered = contacts.filter((contact) => {
      // Search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const fullName =
          `${contact.firstName} ${contact.lastName}`.toLowerCase();
        const username = contact.username?.toLowerCase() || "";
        if (!fullName.includes(query) && !username.includes(query)) {
          return false;
        }
      }

      // Single tag filter (new UI)
      if (filters.selectedTag) {
        if (!contact.tags.includes(filters.selectedTag)) {
          return false;
        }
      }

      // Tags filter (legacy)
      if (filters.tags.length > 0) {
        if (!filters.tags.some((t) => contact.tags.includes(t))) {
          return false;
        }
      }

      // Has notes filter
      if (filters.hasNotes !== null) {
        const hasNotes = contact.notes.trim().length > 0;
        if (filters.hasNotes !== hasNotes) {
          return false;
        }
      }

      // Days since contact filter
      if (contact.daysSinceContact !== undefined) {
        if (
          filters.minDaysSinceContact !== null &&
          contact.daysSinceContact < filters.minDaysSinceContact
        ) {
          return false;
        }
        if (
          filters.maxDaysSinceContact !== null &&
          contact.daysSinceContact > filters.maxDaysSinceContact
        ) {
          return false;
        }
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = `${a.firstName} ${a.lastName}`.localeCompare(
            `${b.firstName} ${b.lastName}`
          );
          break;
        case "lastContact":
          comparison =
            (a.lastContactDate || 0) - (b.lastContactDate || 0);
          break;
        case "daysSinceContact":
          comparison =
            (a.daysSinceContact || Infinity) -
            (b.daysSinceContact || Infinity);
          break;
        case "tagCount":
          comparison = a.tags.length - b.tags.length;
          break;
        case "unread":
          comparison = (a.unreadCount || 0) - (b.unreadCount || 0);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  },

  getNeverContactedCount: () => {
    const { contacts } = get();
    return contacts.filter((c) => c.daysSinceContact === undefined || c.daysSinceContact === null).length;
  },
}));

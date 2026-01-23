import { create } from "zustand";
import type {
  Contact,
  ContactFilters,
  ContactSortField,
  SortDirection,
} from "@/types/contacts";
import * as tauri from "@/lib/tauri";

interface ContactStore {
  contacts: Contact[];
  selectedContactId: number | null;
  filters: ContactFilters;
  sortField: ContactSortField;
  sortDirection: SortDirection;
  allTags: string[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadContacts: () => Promise<void>;
  selectContact: (userId: number | null) => void;
  addTag: (userId: number, tag: string) => Promise<void>;
  removeTag: (userId: number, tag: string) => Promise<void>;
  updateNotes: (userId: number, notes: string) => Promise<void>;
  setFilters: (filters: Partial<ContactFilters>) => void;
  setSorting: (field: ContactSortField, direction: SortDirection) => void;
  clearError: () => void;

  // Computed
  getFilteredContacts: () => Contact[];
}

const defaultFilters: ContactFilters = {
  searchQuery: "",
  tags: [],
  hasNotes: null,
  minDaysSinceContact: null,
  maxDaysSinceContact: null,
};

export const useContactStore = create<ContactStore>((set, get) => ({
  contacts: [],
  selectedContactId: null,
  filters: defaultFilters,
  sortField: "name",
  sortDirection: "asc",
  allTags: [],
  isLoading: false,
  error: null,

  loadContacts: async () => {
    set({ isLoading: true, error: null });
    try {
      const contacts = (await tauri.getContacts()) as Contact[];
      const allTags = [...new Set(contacts.flatMap((c) => c.tags))];
      set({ contacts, allTags });
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  selectContact: (userId) => set({ selectedContactId: userId }),

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
          : [...state.allTags, tag],
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

  clearError: () => set({ error: null }),

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

      // Tags filter
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
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  },
}));

import { create } from "zustand";
import * as tauri from "@/lib/tauri";
import type { ResolveResult } from "@/lib/tauri";

export interface OutreachRecipient {
  userId: number;
  firstName: string;
  lastName: string;
  username?: string;
  status: "pending" | "sending" | "sent" | "failed";
  error?: string;
  sentAt?: number;
}

export interface OutreachQueue {
  id: string;
  template: string;
  recipients: OutreachRecipient[];
  status: "idle" | "running" | "paused" | "completed" | "cancelled";
  startedAt?: number;
  completedAt?: number;
  sentCount: number;
  failedCount: number;
}

export type InputMode = "contacts" | "handles";

export interface ResolvedHandle {
  username: string;
  status: ResolveResult["status"];
  userId: number | null;
  firstName: string | null;
  lastName: string | null;
  error: string | null;
}

interface OutreachStore {
  template: string;
  selectedRecipientIds: number[];
  activeQueue: OutreachQueue | null;
  queues: OutreachQueue[];
  isLoading: boolean;
  error: string | null;

  // Handles mode state
  inputMode: InputMode;
  handleInput: string;
  resolvedHandles: ResolvedHandle[];
  isResolving: boolean;

  // Actions
  setTemplate: (template: string) => void;
  selectRecipients: (ids: number[]) => void;
  toggleRecipient: (id: number) => void;
  selectByTag: (tag: string, contacts: { userId: number; tags: string[] }[]) => void;
  startOutreach: () => Promise<void>;
  cancelOutreach: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  clearError: () => void;
  reset: () => void;

  // Handles mode actions
  setInputMode: (mode: InputMode) => void;
  setHandleInput: (input: string) => void;
  resolveHandles: () => Promise<void>;
  removeResolvedHandle: (username: string) => void;
  clearResolvedHandles: () => void;
  startOutreachFromHandles: () => Promise<void>;

  // Template helpers
  previewMessage: (
    recipientId: number,
    contacts: { userId: number; firstName: string; lastName: string }[]
  ) => string;
}

function parseHandleInput(input: string): string[] {
  // Split by newlines, commas, whitespace; strip @, deduplicate, validate
  const raw = input.split(/[\n,\s]+/).filter(Boolean);
  const cleaned = raw.map((h) => h.trim().replace(/^@/, ""));
  const unique = [...new Set(cleaned)];
  return unique.filter((h) => /^[a-zA-Z0-9_]{4,32}$/.test(h));
}

export const useOutreachStore = create<OutreachStore>((set, get) => ({
  template: "",
  selectedRecipientIds: [],
  activeQueue: null,
  queues: [],
  isLoading: false,
  error: null,

  // Handles mode defaults
  inputMode: "contacts",
  handleInput: "",
  resolvedHandles: [],
  isResolving: false,

  setTemplate: (template) => set({ template }),

  selectRecipients: (ids) => set({ selectedRecipientIds: ids }),

  toggleRecipient: (id) => {
    set((state) => ({
      selectedRecipientIds: state.selectedRecipientIds.includes(id)
        ? state.selectedRecipientIds.filter((rid) => rid !== id)
        : [...state.selectedRecipientIds, id],
    }));
  },

  selectByTag: (tag, contacts) => {
    const matchingIds = contacts
      .filter((c) => c.tags.includes(tag))
      .map((c) => c.userId);
    set((state) => ({
      selectedRecipientIds: [
        ...new Set([...state.selectedRecipientIds, ...matchingIds]),
      ],
    }));
  },

  startOutreach: async () => {
    const { template, selectedRecipientIds } = get();

    if (!template.trim() || selectedRecipientIds.length === 0) {
      set({ error: "Template and recipients are required" });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const queueId = await tauri.queueOutreachMessages(
        selectedRecipientIds,
        template
      );
      const status = (await tauri.getOutreachStatus(queueId)) as OutreachQueue;
      set({
        activeQueue: status,
        queues: [...get().queues, status],
      });
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  cancelOutreach: async () => {
    const { activeQueue } = get();
    if (!activeQueue) return;

    try {
      await tauri.cancelOutreach(activeQueue.id);
      set((state) => ({
        activeQueue: state.activeQueue
          ? { ...state.activeQueue, status: "cancelled" }
          : null,
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  refreshStatus: async () => {
    const { activeQueue } = get();
    if (!activeQueue || activeQueue.status === "completed") return;

    try {
      const status = (await tauri.getOutreachStatus(
        activeQueue.id
      )) as OutreachQueue;
      set({ activeQueue: status });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      template: "",
      selectedRecipientIds: [],
      activeQueue: null,
      isLoading: false,
      error: null,
    }),

  // Handles mode actions

  setInputMode: (mode) => set({ inputMode: mode }),

  setHandleInput: (input) => set({ handleInput: input }),

  resolveHandles: async () => {
    const { handleInput } = get();
    const usernames = parseHandleInput(handleInput);

    if (usernames.length === 0) {
      set({ error: "No valid usernames found. Usernames must be 4-32 characters (letters, numbers, underscores)." });
      return;
    }

    set({ isResolving: true, error: null });
    try {
      const results = await tauri.resolveUsernames(usernames);
      set({ resolvedHandles: results });
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isResolving: false });
    }
  },

  removeResolvedHandle: (username) => {
    set((state) => ({
      resolvedHandles: state.resolvedHandles.filter(
        (h) => h.username !== username
      ),
    }));
  },

  clearResolvedHandles: () => set({ resolvedHandles: [], handleInput: "" }),

  startOutreachFromHandles: async () => {
    const { template, resolvedHandles } = get();

    const sendable = resolvedHandles.filter(
      (h) => h.status === "resolved" && h.userId != null
    );

    if (!template.trim() || sendable.length === 0) {
      set({ error: "Template and at least one resolved user are required" });
      return;
    }

    const recipientIds = sendable.map((h) => h.userId!);
    const recipientNames: [number, string, string][] = sendable.map((h) => [
      h.userId!,
      h.firstName || "",
      h.lastName || "",
    ]);

    set({ isLoading: true, error: null });
    try {
      const queueId = await tauri.queueOutreachMessages(
        recipientIds,
        template,
        recipientNames
      );
      const status = (await tauri.getOutreachStatus(queueId)) as OutreachQueue;
      set({
        activeQueue: status,
        queues: [...get().queues, status],
      });
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  previewMessage: (recipientId, contacts) => {
    const { template } = get();
    const contact = contacts.find((c) => c.userId === recipientId);
    if (!contact) return template;

    const firstName = contact.firstName || "there";
    const lastName = contact.lastName || "";
    const fullName = lastName ? `${firstName} ${lastName}` : firstName;

    return template
      .replace(/\{name\}/g, firstName)
      .replace(/\{first_name\}/g, firstName)
      .replace(/\{last_name\}/g, lastName)
      .replace(/\{full_name\}/g, fullName);
  },
}));

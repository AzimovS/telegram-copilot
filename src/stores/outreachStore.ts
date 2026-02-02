import { create } from "zustand";
import * as tauri from "@/lib/tauri";

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

interface OutreachStore {
  template: string;
  selectedRecipientIds: number[];
  activeQueue: OutreachQueue | null;
  queues: OutreachQueue[];
  isLoading: boolean;
  error: string | null;

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

  // Template helpers
  previewMessage: (
    recipientId: number,
    contacts: { userId: number; firstName: string; lastName: string }[]
  ) => string;
}

export const useOutreachStore = create<OutreachStore>((set, get) => ({
  template: "",
  selectedRecipientIds: [],
  activeQueue: null,
  queues: [],
  isLoading: false,
  error: null,

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
    console.log("[Outreach] Starting with", selectedRecipientIds.length, "recipients");

    if (!template.trim() || selectedRecipientIds.length === 0) {
      set({ error: "Template and recipients are required" });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      console.log("[Outreach] Calling queueOutreachMessages...");
      const queueId = await tauri.queueOutreachMessages(
        selectedRecipientIds,
        template
      );
      console.log("[Outreach] Queue created:", queueId);
      const status = (await tauri.getOutreachStatus(queueId)) as OutreachQueue;
      console.log("[Outreach] Status:", status);
      set({
        activeQueue: status,
        queues: [...get().queues, status],
      });
    } catch (error) {
      console.error("[Outreach] Error:", error);
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

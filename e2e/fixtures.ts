import { test as base, type Page } from "@playwright/test";

// ── Types ──────────────────────────────────────────────────────────

type IpcHandlers = Record<string, unknown>;

interface TauriMockConfig {
  handlers: IpcHandlers;
}

// ── Default IPC handlers ───────────────────────────────────────────

const DEFAULT_HANDLERS: IpcHandlers = {
  // Auth
  connect: true,
  get_current_user: {
    id: 1,
    firstName: "Test",
    lastName: "User",
    username: "testuser",
    phoneNumber: "+1234567890",
  },
  get_auth_state: { type: "ready" },
  send_phone_number: null,
  send_auth_code: null,
  send_password: null,
  logout: null,

  // Chats
  get_chats: [],
  get_chat: null,
  get_chat_messages: [],
  get_batch_messages: [],
  send_message: null,
  invalidate_chat_cache: null,

  // Contacts
  get_contacts: { contacts: [], cached: false, cacheAge: null },
  add_contact_tag: null,
  remove_contact_tag: null,
  update_contact_notes: null,

  // Scopes
  get_folders: [],
  save_scope: null,
  load_scope: null,
  list_scopes: [],

  // Outreach
  queue_outreach_messages: "queue-1",
  get_outreach_status: null,
  cancel_outreach: null,

  // Offboard
  get_common_groups: [],
  remove_from_group: null,

  // AI
  generate_briefing_v2: {
    needs_response: [],
    fyi_summaries: [],
    stats: { needs_response_count: 0, fyi_count: 0, total_unread: 0 },
    generated_at: new Date().toISOString(),
    cached: false,
  },
  generate_batch_summaries: { summaries: [], cached: false },
  generate_draft: { draft: "AI draft", chat_id: 0 },
};

// ── Init script injected via page.addInitScript ────────────────────

// This script runs in the browser context BEFORE any app code loads.
// It sets up window.__TAURI_INTERNALS__ to intercept all Tauri IPC calls.
function tauriInitScript(config: TauriMockConfig) {
  const handlers = config.handlers;

  // Callback registry for Tauri's transformCallback/runCallback system
  let callbackId = 0;
  const callbacks: Record<number, (response: unknown) => void> = {};

  // Event listener registry
  let listenerId = 0;
  const eventListeners: Record<
    string,
    { id: number; handler: (event: unknown) => void }[]
  > = {};

  function transformCallback(callback: (response: unknown) => void): number {
    const id = callbackId++;
    callbacks[id] = callback;
    return id;
  }

  function runCallback(id: number, response: unknown) {
    const cb = callbacks[id];
    if (cb) {
      cb(response);
    }
  }

  async function invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
    // Handle event system plugin commands
    if (cmd === "plugin:event|listen") {
      const event = args?.event as string;
      const handler = args?.handler as number;
      const id = listenerId++;

      if (!eventListeners[event]) {
        eventListeners[event] = [];
      }
      eventListeners[event].push({
        id,
        handler: (payload: unknown) => runCallback(handler, { event, payload }),
      });

      return id;
    }

    if (cmd === "plugin:event|unlisten") {
      const event = args?.event as string;
      const eventId = args?.eventId as number;
      if (eventListeners[event]) {
        eventListeners[event] = eventListeners[event].filter(
          (l) => l.id !== eventId
        );
      }
      return;
    }

    if (cmd === "plugin:event|emit") {
      const event = args?.event as string;
      const payload = args?.payload;
      const listeners = eventListeners[event] || [];
      for (const listener of listeners) {
        listener.handler(payload);
      }
      return;
    }

    // Look up command in handlers
    if (!(cmd in handlers)) {
      console.warn(`[mockTauriIPC] Unhandled command: "${cmd}". Add it to your test handlers.`);
      return null;
    }

    const response = handlers[cmd];

    // Special markers
    if (response !== null && typeof response === "object") {
      const obj = response as Record<string, unknown>;
      if ("__error" in obj) {
        // Throw the raw string — real Tauri invoke rejects with a string, not an Error object.
        // authStore uses String(error) which would produce "Error: msg" for Error objects
        // but just "msg" for plain strings, matching real Tauri behavior.
        throw obj.__error as string;
      }
      if ("__pending" in obj) {
        // Never resolves — simulates a loading/connecting state
        return new Promise(() => {});
      }
    }

    return response ?? null;
  }

  // Install the mock on the window object
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
    invoke,
    transformCallback,
    runCallback,
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { label: "main" },
    },
  };

  // The real @tauri-apps/api/event uses this for listener cleanup.
  // Without it, component unmount (e.g. useTelegramEvents cleanup) throws TypeError.
  (window as unknown as Record<string, unknown>).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: (_event: string, _eventId: number) => {},
  };
}

// ── Settings helper ────────────────────────────────────────────────

interface SettingsOverrides {
  onboardingCompleted?: boolean;
  chatFilters?: Record<string, unknown>;
  cacheTTL?: Record<string, unknown>;
  defaultTags?: string[];
}

function buildSettingsLocalStorage(overrides: SettingsOverrides): string {
  const defaultState = {
    defaultTags: [
      "investor",
      "builder",
      "enterprise",
      "community",
      "personal",
      "colleague",
      "candidate",
      "defi",
      "founder",
    ],
    chatFilters: {
      includePrivateChats: true,
      includeNonContacts: true,
      includeGroups: true,
      includeChannels: true,
      includeBots: false,
      includeArchived: false,
      includeMuted: false,
      groupSizeRange: null,
      selectedFolderIds: [],
    },
    cacheTTL: {
      briefingTTLMinutes: 60,
      summaryTTLMinutes: 360,
      contactsTTLMinutes: 10080,
    },
    onboardingCompleted: false,
    ...overrides,
  };

  return JSON.stringify({
    state: defaultState,
    version: 3,
  });
}

// ── Playwright fixture ─────────────────────────────────────────────

export const test = base.extend<{
  mockTauriIPC: (handlers?: IpcHandlers) => Promise<void>;
  setSettings: (overrides?: SettingsOverrides) => Promise<void>;
}>({
  mockTauriIPC: async ({ page }, use) => {
    const fn = async (handlers: IpcHandlers = {}) => {
      const merged = { ...DEFAULT_HANDLERS, ...handlers };
      await page.addInitScript(tauriInitScript, { handlers: merged });
    };
    await use(fn);
  },

  setSettings: async ({ page }, use) => {
    const fn = async (overrides: SettingsOverrides = {}) => {
      await page.addInitScript(
        (settingsJson: string) => {
          localStorage.setItem("settings-storage", settingsJson);
        },
        buildSettingsLocalStorage(overrides)
      );
    };
    await use(fn);
  },
});

export { expect } from "@playwright/test";

// ── Convenience: setup helper combining mock + settings + goto ─────

export async function setupApp(
  page: Page,
  options: {
    handlers?: IpcHandlers;
    settings?: SettingsOverrides;
  } = {}
) {
  const merged = { ...DEFAULT_HANDLERS, ...options.handlers };
  await page.addInitScript(tauriInitScript, { handlers: merged });
  await page.addInitScript(
    (settingsJson: string) => {
      localStorage.setItem("settings-storage", settingsJson);
    },
    buildSettingsLocalStorage(options.settings ?? {})
  );
  await page.goto("/");
}

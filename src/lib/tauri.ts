import { invoke } from "@tauri-apps/api/core";
import type { AuthState, User, Chat, Message, Folder } from "@/types/telegram";
import type { Contact } from "@/types/contacts";
import type { ChatFilterSettings } from "@/stores/settingsStore";

// Convert frontend filter settings to backend format
export interface ChatFilters {
  includePrivateChats: boolean;
  includeNonContacts: boolean;
  includeGroups: boolean;
  includeChannels: boolean;
  includeBots: boolean;
  includeArchived: boolean;
  includeMuted: boolean;
  groupSizeMin: number | null;
  groupSizeMax: number | null;
  selectedFolderIds: number[];
  // Pre-computed list of chat IDs from selected folders (union of all includedChatIds)
  folderChatIds: number[];
}

export function chatFiltersFromSettings(
  settings: ChatFilterSettings,
  folders?: Folder[]
): ChatFilters {
  // Convert groupSizeRange [min, max] to separate min/max fields for backend
  const groupSizeMin = settings.groupSizeRange ? settings.groupSizeRange[0] : null;
  const groupSizeMax = settings.groupSizeRange ? settings.groupSizeRange[1] : null;

  // Compute folderChatIds from selected folders (union of all includedChatIds)
  // This implements OR logic between folders - a chat is shown if it's in ANY selected folder
  let folderChatIds: number[] = [];
  if (settings.selectedFolderIds.length > 0 && folders) {
    const selectedFolders = folders.filter((f) =>
      settings.selectedFolderIds.includes(f.id)
    );
    // Collect all includedChatIds from selected folders (deduplicated)
    const chatIdSet = new Set<number>();
    for (const folder of selectedFolders) {
      for (const chatId of folder.includedChatIds) {
        chatIdSet.add(chatId);
      }
    }
    folderChatIds = Array.from(chatIdSet);
  }

  return {
    includePrivateChats: settings.includePrivateChats,
    includeNonContacts: settings.includeNonContacts,
    includeGroups: settings.includeGroups,
    includeChannels: settings.includeChannels,
    includeBots: settings.includeBots,
    includeArchived: settings.includeArchived,
    includeMuted: settings.includeMuted,
    groupSizeMin,
    groupSizeMax,
    selectedFolderIds: settings.selectedFolderIds,
    folderChatIds,
  };
}

// Auth commands
export async function connect(): Promise<boolean> {
  return invoke("connect");
}

export async function sendPhoneNumber(phoneNumber: string): Promise<void> {
  return invoke("send_phone_number", { phoneNumber });
}

export async function sendAuthCode(code: string): Promise<void> {
  return invoke("send_auth_code", { code });
}

export async function sendPassword(password: string): Promise<void> {
  return invoke("send_password", { password });
}

export async function getAuthState(): Promise<AuthState> {
  return invoke("get_auth_state");
}

export async function getCurrentUser(): Promise<User | null> {
  return invoke("get_current_user");
}

export async function logout(): Promise<void> {
  return invoke("logout");
}

// Chat commands
export async function getChats(limit: number, filters?: ChatFilters): Promise<Chat[]> {
  return invoke("get_chats", { limit, filters });
}

export async function getChatMessages(
  chatId: number,
  limit: number,
  fromMessageId?: number
): Promise<Message[]> {
  return invoke("get_chat_messages", { chatId, limit, fromMessageId });
}

export async function sendMessage(chatId: number, text: string): Promise<Message> {
  return invoke("send_message", { chatId, text });
}

// Contact commands
export async function getContacts(): Promise<Contact[]> {
  return invoke("get_contacts");
}

export async function addContactTag(
  userId: number,
  tag: string
): Promise<void> {
  return invoke("add_contact_tag", { userId, tag });
}

export async function removeContactTag(
  userId: number,
  tag: string
): Promise<void> {
  return invoke("remove_contact_tag", { userId, tag });
}

export async function updateContactNotes(
  userId: number,
  notes: string
): Promise<void> {
  return invoke("update_contact_notes", { userId, notes });
}

// Scope commands
export async function getFolders(): Promise<Folder[]> {
  return invoke("get_folders");
}

export async function saveScope(name: string, config: unknown): Promise<void> {
  return invoke("save_scope", { name, config });
}

export async function loadScope(name: string): Promise<unknown> {
  return invoke("load_scope", { name });
}

export async function listScopes(): Promise<string[]> {
  return invoke("list_scopes");
}

// Outreach commands
export async function queueOutreachMessages(
  recipientIds: number[],
  template: string
): Promise<string> {
  return invoke("queue_outreach_messages", { recipientIds, template });
}

export async function getOutreachStatus(queueId: string): Promise<unknown> {
  return invoke("get_outreach_status", { queueId });
}

export async function cancelOutreach(queueId: string): Promise<void> {
  return invoke("cancel_outreach", { queueId });
}

// Offboard commands
export interface CommonGroup {
  id: number;
  title: string;
  canRemove: boolean;
  memberCount?: number;
}

export async function getCommonGroups(userId: number): Promise<CommonGroup[]> {
  return invoke("get_common_groups", { userId });
}

export async function removeFromGroup(chatId: number, userId: number): Promise<void> {
  return invoke("remove_from_group", { chatId, userId });
}

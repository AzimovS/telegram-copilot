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
  // Only include chats with unread messages (unread_count > 0)
  includeUnreadOnly?: boolean;
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

export async function getChat(chatId: number): Promise<Chat | null> {
  return invoke("get_chat", { chatId });
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

export interface BatchMessageRequest {
  chatId: number;
  limit: number;
}

export interface BatchMessageResult {
  chatId: number;
  messages: Message[];
  error: string | null;
}

export async function getBatchMessages(
  requests: BatchMessageRequest[]
): Promise<BatchMessageResult[]> {
  return invoke("get_batch_messages", { requests });
}

export async function invalidateChatCache(): Promise<void> {
  return invoke("invalidate_chat_cache");
}

// Contact commands
export interface ContactsResponse {
  contacts: Contact[];
  cached: boolean;
  cacheAge: string | null;
}

export async function getContacts(
  forceRefresh?: boolean,
  ttlMinutes?: number
): Promise<ContactsResponse> {
  return invoke("get_contacts", { forceRefresh, ttlMinutes });
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
  template: string,
  recipientNames?: [number, string, string][]
): Promise<string> {
  return invoke("queue_outreach_messages", { recipientIds, template, recipientNames });
}

export async function getOutreachStatus(queueId: string): Promise<unknown> {
  return invoke("get_outreach_status", { queueId });
}

export async function cancelOutreach(queueId: string): Promise<void> {
  return invoke("cancel_outreach", { queueId });
}

// Resolve usernames
export interface ResolveResult {
  username: string;
  status: "resolved" | "not_found" | "is_group" | "is_channel" | "error";
  userId: number | null;
  firstName: string | null;
  lastName: string | null;
  error: string | null;
}

export async function resolveUsernames(usernames: string[]): Promise<ResolveResult[]> {
  return invoke("resolve_usernames", { usernames });
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

// AI commands

export interface ChatContext {
  chat_id: number;
  chat_title: string;
  chat_type: string;
  messages: {
    id: number;
    sender_name: string;
    text: string;
    date: number;
    is_outgoing: boolean;
  }[];
  unread_count?: number;
  last_message_is_outgoing?: boolean;
  has_unanswered_question?: boolean;
  hours_since_last_activity?: number;
  is_private_chat?: boolean;
}

export interface ChatSummaryContext {
  chat_id: number;
  chat_title: string;
  chat_type: string;
  messages: {
    id: number;
    sender_name: string;
    text: string;
    date: number;
    is_outgoing: boolean;
  }[];
  unread_count?: number;
}

export interface DraftMessage {
  sender_name: string;
  text: string;
  is_outgoing: boolean;
}

export interface ResponseItem {
  id: number;
  chat_id: number;
  chat_name: string;
  chat_type: "dm" | "group" | "channel";
  unread_count: number;
  last_message: string | null;
  last_message_date: string | null;
  priority: "urgent" | "needs_reply";
  summary: string;
  suggested_reply: string | null;
}

export interface FYIItemData {
  id: number;
  chat_id: number;
  chat_name: string;
  chat_type: "dm" | "group" | "channel";
  unread_count: number;
  last_message: string | null;
  last_message_date: string | null;
  priority: "fyi";
  summary: string;
}

export interface BriefingStats {
  needs_response_count: number;
  fyi_count: number;
  total_unread: number;
}

export interface BriefingV2Response {
  needs_response: ResponseItem[];
  fyi_summaries: FYIItemData[];
  stats: BriefingStats;
  generated_at: string;
  cached: boolean;
  cache_age?: string;
  cancelled: boolean;
}

export interface ChatSummaryResult {
  chat_id: number;
  chat_title: string;
  chat_type: string;
  summary: string;
  key_points: string[];
  action_items: string[];
  sentiment: string;
  needs_response: boolean;
  message_count: number;
  last_message_date: number;
}

export interface BatchSummaryResponse {
  summaries: ChatSummaryResult[];
  total_count: number;
  generated_at: number;
  cached: boolean;
  cancelled: boolean;
}

export interface DraftResponse {
  draft: string;
  chat_id: number;
}

export async function generateBriefingV2(
  chats: ChatContext[],
  forceRefresh: boolean,
  ttlMinutes: number
): Promise<BriefingV2Response> {
  return invoke("generate_briefing_v2", { chats, forceRefresh, ttlMinutes });
}

export async function generateBatchSummaries(
  chats: ChatSummaryContext[],
  regenerate: boolean,
  ttlMinutes: number
): Promise<BatchSummaryResponse> {
  return invoke("generate_batch_summaries", { chats, regenerate, ttlMinutes });
}

export async function generateDraft(
  chatId: number,
  chatTitle: string,
  messages: DraftMessage[]
): Promise<DraftResponse> {
  return invoke("generate_draft", { chatId, chatTitle, messages });
}

// LLM Config types and commands

export interface LLMConfig {
  provider: "openai" | "ollama";
  base_url: string;
  api_key: string | null;
  model: string;
}

export interface OllamaModel {
  name: string;
  size: number | null;
  modified_at: string | null;
  parameter_size: string | null;
}

export async function getLLMConfig(): Promise<LLMConfig> {
  return invoke("get_llm_config");
}

export async function updateLLMConfig(config: LLMConfig): Promise<void> {
  return invoke("update_llm_config", { config });
}

export async function listOllamaModels(baseUrl?: string): Promise<OllamaModel[]> {
  return invoke("list_ollama_models_cmd", { baseUrl });
}

export async function testLLMConnection(config: LLMConfig): Promise<string> {
  return invoke("test_llm_connection", { config });
}

export async function isLLMConfigured(): Promise<boolean> {
  return invoke("is_llm_configured");
}

import { invoke } from "@tauri-apps/api/core";

// Auth commands
export async function sendPhoneNumber(phoneNumber: string): Promise<void> {
  return invoke("send_phone_number", { phoneNumber });
}

export async function sendAuthCode(code: string): Promise<void> {
  return invoke("send_auth_code", { code });
}

export async function sendPassword(password: string): Promise<void> {
  return invoke("send_password", { password });
}

export async function getAuthState(): Promise<string> {
  return invoke("get_auth_state");
}

export async function logout(): Promise<void> {
  return invoke("logout");
}

// Chat commands
export async function getChats(limit: number, offsetOrder?: number): Promise<unknown[]> {
  return invoke("get_chats", { limit, offsetOrder });
}

export async function getChatMessages(
  chatId: number,
  limit: number,
  fromMessageId?: number
): Promise<unknown[]> {
  return invoke("get_chat_messages", { chatId, limit, fromMessageId });
}

export async function sendMessage(chatId: number, text: string): Promise<unknown> {
  return invoke("send_message", { chatId, text });
}

// Contact commands
export async function getContacts(): Promise<unknown[]> {
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
export async function getFolders(): Promise<unknown[]> {
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

// Briefing commands
export async function generateBriefing(chatIds: number[]): Promise<unknown> {
  return invoke("generate_briefing", { chatIds });
}

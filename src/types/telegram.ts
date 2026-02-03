export interface User {
  id: number;
  firstName: string;
  lastName: string;
  username?: string;
  phoneNumber?: string;
  profilePhotoUrl?: string;
}

export interface Chat {
  id: number;
  type: ChatType;
  title: string;
  lastMessage?: Message;
  unreadCount: number;
  isPinned: boolean;
  order: number;
  photo?: string;
  memberCount?: number;
  isMuted?: boolean;
  isArchived?: boolean;
  isBot?: boolean;
  isContact?: boolean;
}

export type ChatType = "private" | "group" | "supergroup" | "channel" | "secret";

export interface Message {
  id: number;
  chatId: number;
  senderId: number;
  senderName: string;
  content: MessageContent;
  date: number;
  isOutgoing: boolean;
  isRead: boolean;
}

export type MessageContent =
  | { type: "text"; text: string }
  | { type: "photo"; caption?: string }
  | { type: "video"; caption?: string }
  | { type: "document"; fileName: string }
  | { type: "voice"; duration: number }
  | { type: "sticker"; emoji?: string }
  | { type: "unknown" };

export interface Folder {
  id: number;
  title: string;
  emoticon?: string;
  includedChatIds: number[];
  excludedChatIds: number[];
  includeContacts: boolean;
  includeNonContacts: boolean;
  includeGroups: boolean;
  includeChannels: boolean;
  includeBots: boolean;
}

export type AuthState =
  | { type: "waitPhoneNumber" }
  | { type: "waitCode"; phoneNumber: string }
  | { type: "waitPassword"; hint: string }
  | { type: "ready" }
  | { type: "loggingOut" }
  | { type: "closed" };

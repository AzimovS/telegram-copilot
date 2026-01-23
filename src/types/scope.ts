import type { ChatType } from "./telegram";

export interface ScopeProfile {
  id: string;
  name: string;
  folderIds: number[];
  chatTypes: ChatType[];
  excludedChatIds: number[];
  includedChatIds: number[];
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ScopeConfig {
  folderIds: number[];
  chatTypes: ChatType[];
  excludedChatIds: number[];
  includedChatIds: number[];
}

export interface ActiveScope {
  profile: ScopeProfile | null;
  customConfig: ScopeConfig | null;
}

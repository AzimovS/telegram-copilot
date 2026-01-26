export interface Contact {
  userId: number;
  firstName: string;
  lastName: string;
  username?: string;
  phoneNumber?: string;
  profilePhotoUrl?: string;
  tags: string[];
  notes: string;
  lastContactDate?: number;
  daysSinceContact?: number;
  unreadCount?: number;
}

export interface ContactTag {
  name: string;
  color: string;
  count: number;
}

export type ContactSortField =
  | "name"
  | "lastContact"
  | "daysSinceContact"
  | "tagCount"
  | "unread";

export type SortDirection = "asc" | "desc";

// Simplified sort options for the new UI
export type ContactSortOption = "recent" | "name" | "unread";

export interface ContactFilters {
  searchQuery: string;
  tags: string[];
  selectedTag: string | null; // Single tag filter for new UI
  hasNotes: boolean | null;
  minDaysSinceContact: number | null;
  maxDaysSinceContact: number | null;
}

export interface ContactsResponse {
  contacts: Contact[];
  cached: boolean;
  cacheAge?: string;
  generatedAt?: number;
}

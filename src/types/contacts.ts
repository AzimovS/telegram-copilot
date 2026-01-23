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
  | "tagCount";

export type SortDirection = "asc" | "desc";

export interface ContactFilters {
  searchQuery: string;
  tags: string[];
  hasNotes: boolean | null;
  minDaysSinceContact: number | null;
  maxDaysSinceContact: number | null;
}

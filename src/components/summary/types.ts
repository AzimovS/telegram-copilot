export type ChatTypeFilter = "all" | "private" | "group" | "channel";
export type TimeFilter = "week" | "month" | "3months";
export type SortOption = "recent" | "needs_response" | "sentiment" | "messages";

export interface ChatSummary {
  chatId: number;
  chatTitle: string;
  chatType: string;
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  sentiment: "positive" | "neutral" | "negative";
  needsResponse: boolean;
  messageCount: number;
  lastMessageDate: number;
  isLargeGroup?: boolean;
  memberCount?: number;
}

export const LARGE_GROUP_THRESHOLD = 500;
export const MESSAGES_PER_CHAT = 50;
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const typeFilters: {
  value: ChatTypeFilter;
  label: string;
  icon: React.ReactNode | null;
}[] = [
  { value: "all", label: "All", icon: null },
  { value: "private", label: "DMs", icon: null },
  { value: "group", label: "Groups", icon: null },
  { value: "channel", label: "Channels", icon: null },
];

export const timeFilters: { value: TimeFilter; label: string; days: number }[] = [
  { value: "week", label: "Week", days: 7 },
  { value: "month", label: "Month", days: 30 },
  { value: "3months", label: "3 Months", days: 90 },
];

export const sortOptions: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Most Recent" },
  { value: "needs_response", label: "Needs Response First" },
  { value: "sentiment", label: "By Sentiment (Issues First)" },
  { value: "messages", label: "By Message Count" },
];

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  RefreshCw,
  Loader2,
  Clock,
  FileText,
  AlertCircle,
  MessageSquare,
  Users,
  Radio,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as tauri from "@/lib/tauri";

interface SummaryViewProps {
  onOpenChat: (chatId: number) => void;
}

type ChatTypeFilter = "all" | "private" | "group" | "channel";
type TimeFilter = "week" | "month" | "3months";
type SortOption = "recent" | "needs_response" | "sentiment" | "messages";

const LARGE_GROUP_THRESHOLD = 500;
const MESSAGES_PER_CHAT = 50;

interface ChatSummary {
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

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const typeFilters: { value: ChatTypeFilter; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All", icon: null },
  { value: "private", label: "DMs", icon: <MessageSquare className="h-3 w-3" /> },
  { value: "group", label: "Groups", icon: <Users className="h-3 w-3" /> },
  { value: "channel", label: "Channels", icon: <Radio className="h-3 w-3" /> },
];

const timeFilters: { value: TimeFilter; label: string; days: number }[] = [
  { value: "week", label: "Week", days: 7 },
  { value: "month", label: "Month", days: 30 },
  { value: "3months", label: "3 Months", days: 90 },
];

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Most Recent" },
  { value: "needs_response", label: "Needs Response First" },
  { value: "sentiment", label: "By Sentiment (Issues First)" },
  { value: "messages", label: "By Message Count" },
];

export function SummaryView({ onOpenChat }: SummaryViewProps) {
  const [summaries, setSummaries] = useState<ChatSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<ChatTypeFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("week");
  const [needsResponseOnly, setNeedsResponseOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recent");

  // Individual regeneration tracking
  const [regeneratingChatId, setRegeneratingChatId] = useState<number | null>(null);

  // Expanded sections tracking
  const [expandedKeyPoints, setExpandedKeyPoints] = useState<Set<number>>(new Set());
  const [expandedActionItems, setExpandedActionItems] = useState<Set<number>>(new Set());

  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const pageSize = 10;

  // Helper function to calculate human-readable cache age
  const formatCacheAge = (generatedAt: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const diffSeconds = now - generatedAt;

    if (diffSeconds < 60) return "just now";
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return `${Math.floor(diffSeconds / 86400)}d ago`;
  };

  // Helper function to sort summaries
  const sortSummaries = useCallback((items: ChatSummary[]): ChatSummary[] => {
    const sorted = [...items];
    switch (sortBy) {
      case "recent":
        return sorted.sort((a, b) => b.lastMessageDate - a.lastMessageDate);
      case "needs_response":
        return sorted.sort((a, b) => {
          if (a.needsResponse === b.needsResponse) {
            return b.lastMessageDate - a.lastMessageDate;
          }
          return a.needsResponse ? -1 : 1;
        });
      case "sentiment":
        const sentimentOrder = { negative: 0, neutral: 1, positive: 2 };
        return sorted.sort((a, b) => {
          const orderA = sentimentOrder[a.sentiment] ?? 1;
          const orderB = sentimentOrder[b.sentiment] ?? 1;
          if (orderA === orderB) {
            return b.lastMessageDate - a.lastMessageDate;
          }
          return orderA - orderB;
        });
      case "messages":
        return sorted.sort((a, b) => b.messageCount - a.messageCount);
      default:
        return sorted;
    }
  }, [sortBy]);

  // Create local summary for large groups
  const createLargeGroupSummary = (
    chat: { id: number; title: string; type: string; memberCount?: number },
    messageCount: number,
    lastMessageDate: number
  ): ChatSummary => ({
    chatId: chat.id,
    chatTitle: chat.title,
    chatType: chat.type,
    summary: `Large group with ${messageCount} messages in this period. Too many members for detailed AI analysis.`,
    keyPoints: [`${chat.memberCount || 500}+ members`, `${messageCount} recent messages`],
    actionItems: [],
    sentiment: "neutral",
    needsResponse: false,
    messageCount,
    lastMessageDate,
    isLargeGroup: true,
    memberCount: chat.memberCount,
  });

  const loadSummaries = useCallback(async (regenerate = false, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setOffset(0);
      setSummaries([]); // Clear summaries to show loading state
    }
    setError(null);

    try {
      // Get chats from Telegram
      const chats = await tauri.getChats(100);

      // Filter by type
      let filteredChats = chats;
      if (typeFilter !== "all") {
        filteredChats = filteredChats.filter((c) => c.type === typeFilter);
      }

      // Filter by time (based on last message)
      const timeConfig = timeFilters.find((t) => t.value === timeFilter);
      const cutoffDate = Math.floor(Date.now() / 1000) - (timeConfig?.days || 7) * 24 * 60 * 60;
      filteredChats = filteredChats.filter((c) => c.lastMessage?.date && c.lastMessage.date > cutoffDate);

      // Pagination
      const currentOffset = append ? offset : 0;
      const paginatedChats = filteredChats.slice(currentOffset, currentOffset + pageSize);
      setHasMore(currentOffset + pageSize < filteredChats.length);

      if (paginatedChats.length === 0) {
        if (!append) {
          setSummaries([]);
        }
        setLastUpdated(new Date());
        return;
      }

      // Get messages for each chat (with delay to avoid rate limits)
      // Separate large groups that will get local summaries
      const chatContexts = [];
      const largeGroupSummaries: ChatSummary[] = [];

      for (let i = 0; i < paginatedChats.length; i++) {
        const chat = paginatedChats[i];
        try {
          const messages = await tauri.getChatMessages(chat.id, MESSAGES_PER_CHAT);

          // Check if this is a large group (based on memberCount if available)
          const memberCount = (chat as any).memberCount || 0;
          const isLargeGroup = chat.type === "group" && memberCount >= LARGE_GROUP_THRESHOLD;

          if (isLargeGroup) {
            // Create local summary for large groups to save AI tokens
            const lastMessageDate = messages[0]?.date || Math.floor(Date.now() / 1000);
            largeGroupSummaries.push(
              createLargeGroupSummary(
                { id: chat.id, title: chat.title, type: chat.type, memberCount },
                messages.length,
                lastMessageDate
              )
            );
          } else {
            chatContexts.push({
              chat_id: chat.id,
              chat_title: chat.title,
              chat_type: chat.type,
              unread_count: chat.unreadCount,
              messages: messages.map((m) => ({
                id: Number(m.id),
                sender_name: m.senderName,
                text: m.content.type === "text" ? m.content.text : "[Media]",
                date: m.date,
                is_outgoing: m.isOutgoing,
              })),
            });
          }

          // Small delay between requests to avoid rate limiting
          if (i < paginatedChats.length - 1) {
            await new Promise((r) => setTimeout(r, 100));
          }
        } catch (e) {
          console.warn(`Failed to get messages for chat ${chat.id}:`, e);
        }
      }

      // If only large groups (no chats to send to AI)
      if (chatContexts.length === 0 && largeGroupSummaries.length > 0) {
        let newSummaries = sortSummaries(largeGroupSummaries);
        if (needsResponseOnly) {
          newSummaries = newSummaries.filter((s) => s.needsResponse);
        }
        if (append) {
          setSummaries((prev) => sortSummaries([...prev, ...newSummaries]));
          setOffset(currentOffset + pageSize);
        } else {
          setSummaries(newSummaries);
          setOffset(pageSize);
        }
        setLastUpdated(new Date());
        setCacheAge(null);
        setIsCached(false);
        return;
      }

      if (chatContexts.length === 0) {
        if (!append) {
          setSummaries([]);
        }
        setLastUpdated(new Date());
        return;
      }

      // Call AI backend
      const response = await fetch(`${API_URL}/api/summary/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chats: chatContexts,
          regenerate,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();

      // Map to frontend format
      let newSummaries: ChatSummary[] = data.summaries.map((s: any) => ({
        chatId: s.chat_id,
        chatTitle: s.chat_title,
        chatType: s.chat_type,
        summary: s.summary,
        keyPoints: s.key_points,
        actionItems: s.action_items,
        sentiment: s.sentiment,
        needsResponse: s.needs_response,
        messageCount: s.message_count,
        lastMessageDate: s.last_message_date,
      }));

      // Merge with large group summaries
      newSummaries = [...newSummaries, ...largeGroupSummaries];

      // Filter by needs response if enabled
      if (needsResponseOnly) {
        newSummaries = newSummaries.filter((s) => s.needsResponse);
      }

      // Apply sorting
      newSummaries = sortSummaries(newSummaries);

      if (append) {
        setSummaries((prev) => sortSummaries([...prev, ...newSummaries]));
        setOffset(currentOffset + pageSize);
      } else {
        setSummaries(newSummaries);
        setOffset(pageSize);
      }

      setLastUpdated(new Date());
      setIsCached(data.cached);
      // Set cache age from generated_at timestamp
      if (data.cached && data.generated_at) {
        setCacheAge(formatCacheAge(data.generated_at));
      } else {
        setCacheAge(null);
      }
    } catch (err) {
      console.error("Failed to load summaries:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to connect to AI backend."
      );
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [typeFilter, timeFilter, needsResponseOnly, offset, sortSummaries]);

  // Regenerate a single summary
  const regenerateSingle = useCallback(async (chatId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger card click
    setRegeneratingChatId(chatId);

    try {
      const existingSummary = summaries.find((s) => s.chatId === chatId);
      if (!existingSummary || existingSummary.isLargeGroup) return;

      // Get fresh messages
      const messages = await tauri.getChatMessages(chatId, MESSAGES_PER_CHAT);

      const response = await fetch(`${API_URL}/api/summary/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chats: [{
            chat_id: chatId,
            chat_title: existingSummary.chatTitle,
            chat_type: existingSummary.chatType,
            unread_count: 0,
            messages: messages.map((m) => ({
              id: Number(m.id),
              sender_name: m.senderName,
              text: m.content.type === "text" ? m.content.text : "[Media]",
              date: m.date,
              is_outgoing: m.isOutgoing,
            })),
          }],
          regenerate: true,
        }),
      });

      if (!response.ok) throw new Error(`Backend error: ${response.status}`);

      const data = await response.json();
      if (data.summaries && data.summaries.length > 0) {
        const newSummary = data.summaries[0];
        setSummaries((prev) =>
          prev.map((s) =>
            s.chatId === chatId
              ? {
                  chatId: newSummary.chat_id,
                  chatTitle: newSummary.chat_title,
                  chatType: newSummary.chat_type,
                  summary: newSummary.summary,
                  keyPoints: newSummary.key_points,
                  actionItems: newSummary.action_items,
                  sentiment: newSummary.sentiment,
                  needsResponse: newSummary.needs_response,
                  messageCount: newSummary.message_count,
                  lastMessageDate: newSummary.last_message_date,
                }
              : s
          )
        );
      }
    } catch (err) {
      console.error("Failed to regenerate summary:", err);
    } finally {
      setRegeneratingChatId(null);
    }
  }, [summaries]);

  // Re-sort when sortBy changes
  useEffect(() => {
    if (summaries.length > 0) {
      setSummaries((prev) => sortSummaries(prev));
    }
  }, [sortBy, sortSummaries]);

  useEffect(() => {
    loadSummaries();
  }, [typeFilter, timeFilter, needsResponseOnly]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "negative":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getChatTypeIcon = (type: string) => {
    switch (type) {
      case "private":
        return <MessageSquare className="h-4 w-4" />;
      case "group":
        return <Users className="h-4 w-4" />;
      case "channel":
        return <Radio className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Conversation Summaries</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered insights into your conversations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isCached ? (cacheAge ? `Cached ${cacheAge}` : "Cached") : lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => loadSummaries(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Type Filter */}
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ChatTypeFilter)}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeFilters.map((filter) => (
              <SelectItem key={filter.value} value={filter.value} className="text-xs">
                <span className="flex items-center gap-1">
                  {filter.icon}
                  {filter.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Time Filter */}
        <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timeFilters.map((filter) => (
              <SelectItem key={filter.value} value={filter.value} className="text-xs">
                {filter.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort Dropdown */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <ArrowUpDown className="h-3 w-3 text-muted-foreground mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Needs Response Filter */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="needsResponse"
            checked={needsResponseOnly}
            onCheckedChange={(checked) => setNeedsResponseOnly(checked === true)}
          />
          <label htmlFor="needsResponse" className="text-sm cursor-pointer">
            Needs Response Only
          </label>
        </div>
      </div>

      {/* Stats */}
      {summaries.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{summaries.length}</p>
            <p className="text-xs text-muted-foreground">Conversations</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">
              {summaries.filter((s) => s.needsResponse).length}
            </p>
            <p className="text-xs text-muted-foreground">Need Response</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">
              {summaries.reduce((acc, s) => acc + s.messageCount, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Total Messages</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                {summaries.filter((s) => s.sentiment === "positive").length}
              </span>
              <span className="flex items-center gap-1">
                <Minus className="h-3 w-3 text-gray-400" />
                {summaries.filter((s) => s.sentiment === "neutral").length}
              </span>
              <span className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-red-500" />
                {summaries.filter((s) => s.sentiment === "negative").length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Sentiment</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && summaries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Generating summaries...</p>
          <p className="text-xs text-muted-foreground mt-1">
            Loading first {pageSize} chats...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && summaries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No conversations found</h2>
          <p className="text-muted-foreground">
            Try adjusting your filters or time range
          </p>
        </div>
      )}

      {/* Summary Cards */}
      {summaries.length > 0 && (
        <div className="space-y-4">
          {summaries.map((summary) => (
            <Card
              key={summary.chatId}
              className={cn(
                "cursor-pointer hover:bg-muted/50 transition-colors",
                summary.needsResponse && "border-l-4 border-l-orange-500",
                summary.isLargeGroup && "border-l-4 border-l-blue-400"
              )}
              onClick={() => onOpenChat(summary.chatId)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      {getChatTypeIcon(summary.chatType)}
                    </div>
                    <div>
                      <h3 className="font-semibold">{summary.chatTitle}</h3>
                      <p className="text-xs text-muted-foreground">
                        {summary.messageCount} messages • {formatDate(summary.lastMessageDate)}
                        {summary.isLargeGroup && (
                          <span className="ml-1 text-blue-500">• Large group</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {summary.needsResponse && (
                      <span className="text-xs bg-orange-500/20 text-orange-600 px-2 py-0.5 rounded">
                        Needs Reply
                      </span>
                    )}
                    {getSentimentIcon(summary.sentiment)}
                    {/* Individual Refresh Button */}
                    {!summary.isLargeGroup && (
                      <button
                        onClick={(e) => regenerateSingle(summary.chatId, e)}
                        className="p-1 rounded hover:bg-muted transition-colors"
                        disabled={regeneratingChatId === summary.chatId}
                        title="Regenerate this summary"
                      >
                        {regeneratingChatId === summary.chatId ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        )}
                      </button>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{summary.summary}</p>

                {summary.keyPoints.length > 0 && (
                  <Collapsible
                    open={expandedKeyPoints.has(summary.chatId)}
                    onOpenChange={(open) => {
                      setExpandedKeyPoints((prev) => {
                        const next = new Set(prev);
                        if (open) next.add(summary.chatId);
                        else next.delete(summary.chatId);
                        return next;
                      });
                    }}
                  >
                    <CollapsibleTrigger
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1 hover:text-foreground transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {expandedKeyPoints.has(summary.chatId) ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      Key Points ({summary.keyPoints.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="text-sm space-y-1">
                        {summary.keyPoints.map((point, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {summary.actionItems.length > 0 && (
                  <Collapsible
                    open={expandedActionItems.has(summary.chatId)}
                    onOpenChange={(open) => {
                      setExpandedActionItems((prev) => {
                        const next = new Set(prev);
                        if (open) next.add(summary.chatId);
                        else next.delete(summary.chatId);
                        return next;
                      });
                    }}
                  >
                    <CollapsibleTrigger
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1 hover:text-foreground transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {expandedActionItems.has(summary.chatId) ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      Action Items ({summary.actionItems.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="text-sm space-y-1">
                        {summary.actionItems.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => loadSummaries(false, true)}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

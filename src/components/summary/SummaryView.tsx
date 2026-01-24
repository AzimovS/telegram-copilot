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
  RefreshCw,
  Loader2,
  Clock,
  FileText,
  AlertCircle,
  MessageSquare,
  Users,
  Radio,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as tauri from "@/lib/tauri";

interface SummaryViewProps {
  onOpenChat: (chatId: number) => void;
}

type ChatTypeFilter = "all" | "private" | "group" | "channel";
type TimeFilter = "week" | "month" | "3months";

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

export function SummaryView({ onOpenChat }: SummaryViewProps) {
  const [summaries, setSummaries] = useState<ChatSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<ChatTypeFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("week");
  const [needsResponseOnly, setNeedsResponseOnly] = useState(false);

  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const pageSize = 10;

  const loadSummaries = useCallback(async (regenerate = false, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setOffset(0);
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

      // Get messages for each chat
      const chatContexts = [];
      for (const chat of paginatedChats) {
        try {
          const messages = await tauri.getChatMessages(chat.id, 30);
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
        } catch (e) {
          console.warn(`Failed to get messages for chat ${chat.id}:`, e);
        }
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

      // Filter by needs response if enabled
      if (needsResponseOnly) {
        newSummaries = newSummaries.filter((s) => s.needsResponse);
      }

      if (append) {
        setSummaries((prev) => [...prev, ...newSummaries]);
        setOffset(currentOffset + pageSize);
      } else {
        setSummaries(newSummaries);
        setOffset(pageSize);
      }

      setLastUpdated(new Date());
      setIsCached(data.cached);
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
  }, [typeFilter, timeFilter, needsResponseOnly, offset]);

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
              {isCached ? "Cached • " : ""}
              {lastUpdated.toLocaleTimeString()}
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
        <div className="flex items-center gap-1">
          {typeFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={typeFilter === filter.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setTypeFilter(filter.value)}
              className="text-xs h-8"
            >
              {filter.icon}
              <span className={filter.icon ? "ml-1" : ""}>{filter.label}</span>
            </Button>
          ))}
        </div>

        {/* Time Filter */}
        <div className="flex items-center gap-1 border-l pl-4">
          {timeFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={timeFilter === filter.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeFilter(filter.value)}
              className="text-xs h-8"
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {/* Needs Response Filter */}
        <div className="flex items-center gap-2 border-l pl-4">
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
        <div className="grid grid-cols-3 gap-4">
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
                summary.needsResponse && "border-l-4 border-l-orange-500"
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
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{summary.summary}</p>

                {summary.keyPoints.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Key Points
                    </p>
                    <ul className="text-sm space-y-1">
                      {summary.keyPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.actionItems.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Action Items
                    </p>
                    <ul className="text-sm space-y-1">
                      {summary.actionItems.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
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

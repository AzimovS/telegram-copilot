import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  RefreshCw,
  Loader2,
  Clock,
  FileText,
  AlertCircle,
} from "lucide-react";
import { ChatTypeFilter, TimeFilter, SortOption } from "./types";
import { SummaryFilters } from "./SummaryFilters";
import { SummaryStats } from "./SummaryStats";
import { SummaryCard } from "./SummaryCard";
import { useSummaries } from "./useSummaries";

interface SummaryViewProps {
  onOpenChat: (chatId: number) => void;
}

export function SummaryView({ onOpenChat }: SummaryViewProps) {
  const [typeFilter, setTypeFilter] = useState<ChatTypeFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("week");
  const [needsResponseOnly, setNeedsResponseOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recent");

  const [expandedKeyPoints, setExpandedKeyPoints] = useState<Set<number>>(new Set());
  const [expandedActionItems, setExpandedActionItems] = useState<Set<number>>(new Set());

  const {
    summaries,
    isLoading,
    error,
    lastUpdated,
    isCached,
    cacheAge,
    regeneratingChatId,
    hasMore,
    isLoadingMore,
    loadSummaries,
    regenerateSingle,
    loadMore,
  } = useSummaries({
    typeFilter,
    timeFilter,
    needsResponseOnly,
    sortBy,
  });

  const pageSize = 10;

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
              {isCached
                ? cacheAge
                  ? `Cached ${cacheAge}`
                  : "Cached"
                : lastUpdated.toLocaleTimeString()}
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
      <SummaryFilters
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        timeFilter={timeFilter}
        setTimeFilter={setTimeFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        needsResponseOnly={needsResponseOnly}
        setNeedsResponseOnly={setNeedsResponseOnly}
      />

      {/* Stats */}
      <SummaryStats summaries={summaries} />

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
            <SummaryCard
              key={summary.chatId}
              summary={summary}
              onOpenChat={onOpenChat}
              onRegenerate={regenerateSingle}
              isRegenerating={regeneratingChatId === summary.chatId}
              expandedKeyPoints={expandedKeyPoints}
              setExpandedKeyPoints={setExpandedKeyPoints}
              expandedActionItems={expandedActionItems}
              setExpandedActionItems={setExpandedActionItems}
            />
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
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

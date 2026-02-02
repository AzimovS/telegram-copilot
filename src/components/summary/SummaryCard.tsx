import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  RefreshCw,
  Loader2,
  MessageSquare,
  Users,
  Radio,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatSummary } from "./types";

interface SummaryCardProps {
  summary: ChatSummary;
  onOpenChat: (chatId: number) => void;
  onRegenerate: (chatId: number, e: React.MouseEvent) => void;
  isRegenerating: boolean;
  expandedKeyPoints: Set<number>;
  setExpandedKeyPoints: React.Dispatch<React.SetStateAction<Set<number>>>;
  expandedActionItems: Set<number>;
  setExpandedActionItems: React.Dispatch<React.SetStateAction<Set<number>>>;
}

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

export function SummaryCard({
  summary,
  onOpenChat,
  onRegenerate,
  isRegenerating,
  expandedKeyPoints,
  setExpandedKeyPoints,
  expandedActionItems,
  setExpandedActionItems,
}: SummaryCardProps) {
  return (
    <Card
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
            {!summary.isLargeGroup && (
              <button
                onClick={(e) => onRegenerate(summary.chatId, e)}
                className="p-1 rounded hover:bg-muted transition-colors"
                disabled={isRegenerating}
                title="Regenerate this summary"
              >
                {isRegenerating ? (
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
  );
}

import { TrendingUp, TrendingDown, Minus, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ChatSummary } from "./types";

interface SummaryStatsProps {
  summaries: ChatSummary[];
}

export function SummaryStats({ summaries }: SummaryStatsProps) {
  if (summaries.length === 0) return null;

  const needsResponseCount = summaries.filter((s) => s.needsResponse).length;
  const totalMessages = summaries.reduce((acc, s) => acc + s.messageCount, 0);
  const positiveCount = summaries.filter((s) => s.sentiment === "positive").length;
  const neutralCount = summaries.filter((s) => s.sentiment === "neutral").length;
  const negativeCount = summaries.filter((s) => s.sentiment === "negative").length;

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="p-4 rounded-lg bg-muted/50">
        <p className="text-2xl font-bold">{summaries.length}</p>
        <p className="text-xs text-muted-foreground">Conversations</p>
      </div>
      <div className="p-4 rounded-lg bg-muted/50">
        <p className="text-2xl font-bold">{needsResponseCount}</p>
        <p className="text-xs text-muted-foreground">Need Response</p>
      </div>
      <div className="p-4 rounded-lg bg-muted/50">
        <p className="text-2xl font-bold">{totalMessages}</p>
        <p className="text-xs text-muted-foreground">Total Messages</p>
      </div>
      <div className="p-4 rounded-lg bg-muted/50">
        <div className="flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            {positiveCount}
          </span>
          <span className="flex items-center gap-1">
            <Minus className="h-3 w-3 text-gray-400" />
            {neutralCount}
          </span>
          <span className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-red-500" />
            {negativeCount}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <p className="text-xs text-muted-foreground">Sentiment</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="max-w-[200px]">
                AI-assessed mood of conversations: positive (things are going well), neutral, or negative (issues, complaints, or tension detected).
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

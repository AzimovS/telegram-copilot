import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare, ChevronRight, AlertCircle, Clock, Info } from "lucide-react";

export interface BriefingItem {
  chatId: number;
  chatTitle: string;
  category: "urgent" | "needs_reply" | "fyi";
  summary: string;
  keyPoints: string[];
  suggestedAction?: string;
  unreadCount: number;
  lastMessageDate: number;
}

interface BriefingCardProps {
  briefing: BriefingItem;
  onOpenChat: () => void;
}

const categoryConfig = {
  urgent: {
    label: "Urgent",
    color: "text-red-500 bg-red-500/10 border-red-500/20",
    icon: AlertCircle,
  },
  needs_reply: {
    label: "Needs Reply",
    color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
    icon: Clock,
  },
  fyi: {
    label: "FYI",
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    icon: Info,
  },
};

export function BriefingCard({ briefing, onOpenChat }: BriefingCardProps) {
  const config = categoryConfig[briefing.category];
  const Icon = config.icon;

  return (
    <Card className={cn("border", config.color)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", config.color.split(" ")[0])} />
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                config.color
              )}
            >
              {config.label}
            </span>
          </div>
          {briefing.unreadCount > 0 && (
            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              {briefing.unreadCount} unread
            </span>
          )}
        </div>
        <CardTitle className="text-base mt-2">{briefing.chatTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary */}
        <p className="text-sm text-muted-foreground">{briefing.summary}</p>

        {/* Key Points */}
        {briefing.keyPoints.length > 0 && (
          <ul className="text-sm space-y-1">
            {briefing.keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Suggested Action */}
        {briefing.suggestedAction && (
          <div className="p-2 bg-muted rounded text-sm">
            <span className="font-medium">Suggested: </span>
            {briefing.suggestedAction}
          </div>
        )}

        {/* Open Chat Button */}
        <Button
          variant="ghost"
          className="w-full justify-between"
          onClick={onOpenChat}
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Open Chat
          </span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

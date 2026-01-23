import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CategoryGroup } from "./CategoryGroup";
import type { BriefingItem } from "./BriefingCard";
import { RefreshCw, Loader2, Clock, Sparkles } from "lucide-react";

interface SmartBriefingProps {
  onOpenChat: (chatId: number) => void;
}

// Mock data for demo - will be replaced with API call
const mockBriefings: BriefingItem[] = [
  {
    chatId: 1,
    chatTitle: "Work Team",
    category: "urgent",
    summary: "The team is waiting for your approval on the Q4 budget proposal.",
    keyPoints: [
      "Budget needs approval by EOD",
      "Marketing requested 15% increase",
    ],
    suggestedAction: "Review and respond to the budget proposal",
    unreadCount: 5,
    lastMessageDate: Date.now() / 1000 - 3600,
  },
  {
    chatId: 2,
    chatTitle: "Mom",
    category: "needs_reply",
    summary: "Your mom asked about your plans for the holidays.",
    keyPoints: ["She wants to know your arrival date"],
    suggestedAction: "Confirm your travel dates",
    unreadCount: 2,
    lastMessageDate: Date.now() / 1000 - 7200,
  },
  {
    chatId: 3,
    chatTitle: "Tech News",
    category: "fyi",
    summary: "Latest updates on AI developments and industry news.",
    keyPoints: [
      "New GPT model announced",
      "Apple keynote scheduled",
    ],
    unreadCount: 12,
    lastMessageDate: Date.now() / 1000 - 10800,
  },
];

export function SmartBriefing({ onOpenChat }: SmartBriefingProps) {
  const [briefings, setBriefings] = useState<BriefingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);

  const loadBriefings = async (regenerate = false) => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/briefing/generate', {
      //   method: 'POST',
      //   body: JSON.stringify({ chats: [...], regenerate }),
      // });
      // const data = await response.json();

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setBriefings(mockBriefings);
      setLastUpdated(new Date());
      setIsCached(!regenerate);
    } catch (error) {
      console.error("Failed to load briefings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBriefings();
  }, []);

  const urgentBriefings = briefings.filter((b) => b.category === "urgent");
  const needsReplyBriefings = briefings.filter(
    (b) => b.category === "needs_reply"
  );
  const fyiBriefings = briefings.filter((b) => b.category === "fyi");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Smart Briefing</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered summary of your conversations
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
            onClick={() => loadBriefings(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">
              {isLoading ? "Analyzing..." : "Regenerate"}
            </span>
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && briefings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Analyzing your conversations...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && briefings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <Sparkles className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No unread messages to brief</p>
        </div>
      )}

      {/* Briefing Categories */}
      {briefings.length > 0 && (
        <div className="space-y-8">
          <CategoryGroup
            category="urgent"
            briefings={urgentBriefings}
            onOpenChat={onOpenChat}
          />
          <CategoryGroup
            category="needs_reply"
            briefings={needsReplyBriefings}
            onOpenChat={onOpenChat}
          />
          <CategoryGroup
            category="fyi"
            briefings={fyiBriefings}
            onOpenChat={onOpenChat}
          />
        </div>
      )}
    </div>
  );
}

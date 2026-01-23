import { BriefingCard, type BriefingItem } from "./BriefingCard";
import { AlertCircle, Clock, Info } from "lucide-react";

interface CategoryGroupProps {
  category: "urgent" | "needs_reply" | "fyi";
  briefings: BriefingItem[];
  onOpenChat: (chatId: number) => void;
}

const categoryConfig = {
  urgent: {
    title: "Urgent",
    description: "Requires immediate attention",
    icon: AlertCircle,
    iconColor: "text-red-500",
  },
  needs_reply: {
    title: "Needs Reply",
    description: "Waiting for your response",
    icon: Clock,
    iconColor: "text-yellow-500",
  },
  fyi: {
    title: "For Your Information",
    description: "No action required",
    icon: Info,
    iconColor: "text-blue-500",
  },
};

export function CategoryGroup({
  category,
  briefings,
  onOpenChat,
}: CategoryGroupProps) {
  const config = categoryConfig[category];
  const Icon = config.icon;

  if (briefings.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${config.iconColor}`} />
        <div>
          <h3 className="font-semibold">{config.title}</h3>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </div>
        <span className="ml-auto text-sm text-muted-foreground">
          {briefings.length} chat{briefings.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {briefings.map((briefing) => (
          <BriefingCard
            key={briefing.chatId}
            briefing={briefing}
            onOpenChat={() => onOpenChat(briefing.chatId)}
          />
        ))}
      </div>
    </div>
  );
}

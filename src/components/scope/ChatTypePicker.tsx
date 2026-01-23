import { useScopeStore } from "@/stores/scopeStore";
import { cn } from "@/lib/utils";
import { User, Users, Megaphone, Check } from "lucide-react";
import type { ChatType } from "@/types/telegram";

interface ChatTypePickerProps {
  selectedTypes: ChatType[];
}

const chatTypeConfig: {
  type: ChatType;
  label: string;
  icon: typeof User;
  description: string;
}[] = [
  {
    type: "private",
    label: "Private",
    icon: User,
    description: "One-on-one chats",
  },
  {
    type: "group",
    label: "Groups",
    icon: Users,
    description: "Regular group chats",
  },
  {
    type: "supergroup",
    label: "Supergroups",
    icon: Users,
    description: "Large group chats",
  },
  {
    type: "channel",
    label: "Channels",
    icon: Megaphone,
    description: "Broadcast channels",
  },
];

export function ChatTypePicker({ selectedTypes }: ChatTypePickerProps) {
  const { toggleChatType } = useScopeStore();

  return (
    <div className="grid grid-cols-2 gap-2">
      {chatTypeConfig.map(({ type, label, icon: Icon, description }) => {
        const isSelected = selectedTypes.includes(type);
        return (
          <button
            key={type}
            onClick={() => toggleChatType(type)}
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg border text-left transition-colors",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              {isSelected ? (
                <Check className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

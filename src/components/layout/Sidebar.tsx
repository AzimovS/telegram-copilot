import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Users,
  Send,
  Briefcase,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const navItems = [
  { id: "chats", label: "Chats", icon: MessageSquare },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "outreach", label: "Outreach", icon: Send },
  { id: "briefing", label: "Briefing", icon: Briefcase },
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { logout } = useAuthStore();

  return (
    <div className="flex h-full w-16 flex-col items-center border-r bg-muted/40 py-4">
      <div className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={currentView === item.id ? "secondary" : "ghost"}
            size="icon"
            className={cn(
              "h-12 w-12",
              currentView === item.id && "bg-secondary"
            )}
            onClick={() => onViewChange(item.id)}
            title={item.label}
          >
            <item.icon className="h-5 w-5" />
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-destructive hover:text-destructive"
          onClick={logout}
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

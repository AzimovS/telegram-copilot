import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Users,
  Send,
  Briefcase,
  Settings,
  LogOut,
  Sun,
  Moon,
  Sparkles,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore, type Theme } from "@/stores/themeStore";

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

const themeOptions: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "night-accent", label: "Night Accent", icon: Sparkles },
  { id: "dark", label: "Dark", icon: Moon },
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

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
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="right" align="end" className="w-48">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Theme</h4>
              <div className="space-y-1">
                {themeOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setTheme(option.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                      theme === option.id && "bg-accent"
                    )}
                  >
                    <option.icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{option.label}</span>
                    {theme === option.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
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

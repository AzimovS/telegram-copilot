import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  FileText,
  MessageSquare,
  Users,
  Send,
  UserMinus,
  LogOut,
  Settings,
  Sun,
  Moon,
  Check,
  Filter,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore, type Theme } from "@/stores/themeStore";
import { ChatFiltersDialog } from "@/components/settings/ChatFiltersDialog";
import { CacheSettingsDialog } from "@/components/settings/CacheSettingsDialog";

export type ViewType = "briefing" | "summary" | "chats" | "contacts" | "outreach" | "offboard";

interface NavHeaderProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const navItems: { id: ViewType; label: string; icon: React.ReactNode }[] = [
  { id: "briefing", label: "Briefing", icon: <Sparkles className="h-4 w-4" /> },
  { id: "summary", label: "Summary", icon: <FileText className="h-4 w-4" /> },
  { id: "chats", label: "Chats", icon: <MessageSquare className="h-4 w-4" /> },
  { id: "contacts", label: "Contacts", icon: <Users className="h-4 w-4" /> },
  { id: "outreach", label: "Outreach", icon: <Send className="h-4 w-4" /> },
  { id: "offboard", label: "Offboard", icon: <UserMinus className="h-4 w-4" /> },
];

const themeOptions: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "night-accent", label: "Night Accent", icon: Sparkles },
  { id: "dark", label: "Dark", icon: Moon },
];

export function NavHeader({ currentView, onViewChange }: NavHeaderProps) {
  const { currentUser, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cacheSettingsOpen, setCacheSettingsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 font-semibold shrink-0">
          <MessageSquare className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">Telegram Copilot</span>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                currentView === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {item.icon}
              <span className="hidden md:inline">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Info & Settings */}
        <div className="flex items-center gap-2 shrink-0">
          {currentUser && (
            <div className="flex items-center gap-2 mr-1">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                {currentUser.firstName?.[0] || "U"}
              </div>
              <span className="text-sm font-medium hidden lg:inline">
                {currentUser.firstName}
              </span>
            </div>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm mb-1">Theme</h4>
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
                <div className="border-t pt-3">
                  <h4 className="font-medium text-sm mb-1">Settings</h4>
                  <button
                    onClick={() => setFiltersOpen(true)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                  >
                    <Filter className="h-4 w-4" />
                    <span className="flex-1 text-left">Chat Filters</span>
                  </button>
                  <button
                    onClick={() => setCacheSettingsOpen(true)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                  >
                    <Clock className="h-4 w-4" />
                    <span className="flex-1 text-left">Cache Settings</span>
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <ChatFiltersDialog open={filtersOpen} onOpenChange={setFiltersOpen} />
          <CacheSettingsDialog open={cacheSettingsOpen} onOpenChange={setCacheSettingsOpen} />
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

// Keep the old Header for backward compatibility in views that need it
interface ViewHeaderProps {
  title: string;
  children?: React.ReactNode;
}

export function ViewHeader({ title, children }: ViewHeaderProps) {
  return (
    <div className="flex h-14 items-center justify-between border-b px-4 shrink-0">
      <h1 className="text-lg font-semibold">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

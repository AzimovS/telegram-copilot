import { useThemeStore, type Theme } from "@/stores/themeStore";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor } from "lucide-react";

interface ThemeOption {
  value: Theme;
  label: string;
  icon: React.ReactNode;
}

const themeOptions: ThemeOption[] = [
  { value: "light", label: "Light", icon: <Sun className="h-5 w-5" /> },
  { value: "dark", label: "Dark", icon: <Moon className="h-5 w-5" /> },
  { value: "night-accent", label: "System", icon: <Monitor className="h-5 w-5" /> },
];

export function ThemeStep() {
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Welcome to Telegram Copilot!</h2>
        <p className="text-muted-foreground">Choose your preferred theme</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {themeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all",
              "hover:border-primary/50 hover:bg-accent/50",
              theme === option.value
                ? "border-primary bg-primary/10"
                : "border-border bg-background"
            )}
          >
            <div
              className={cn(
                "p-3 rounded-full",
                theme === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {option.icon}
            </div>
            <span
              className={cn(
                "font-medium",
                theme === option.value ? "text-primary" : "text-foreground"
              )}
            >
              {option.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useSettingsStore, type CacheTTLSettings } from "@/stores/settingsStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_CACHE_TTL: CacheTTLSettings = {
  briefingTTLMinutes: 60,
  summaryTTLMinutes: 360,
  contactsTTLMinutes: 10080,
};

// TTL options in minutes with labels
const TTL_OPTIONS = [
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 180, label: "3 hours" },
  { value: 360, label: "6 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "1 day" },
  { value: 10080, label: "7 days" },
];

interface CacheSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CacheSettingsDialog({ open, onOpenChange }: CacheSettingsDialogProps) {
  const { cacheTTL, setCacheTTL } = useSettingsStore();
  const [localCacheTTL, setLocalCacheTTL] = useState<CacheTTLSettings>(cacheTTL);

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalCacheTTL(cacheTTL);
    }
  }, [open, cacheTTL]);

  const updateLocalCacheTTL = (updates: Partial<CacheTTLSettings>) => {
    setLocalCacheTTL((prev) => ({ ...prev, ...updates }));
  };

  const handleResetDefaults = () => {
    setLocalCacheTTL(DEFAULT_CACHE_TTL);
  };

  const handleApply = () => {
    setCacheTTL(localCacheTTL);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalCacheTTL(cacheTTL);
    onOpenChange(false);
  };

  // Find closest option value for a given TTL
  const findClosestOption = (ttl: number): string => {
    const closest = TTL_OPTIONS.reduce((prev, curr) =>
      Math.abs(curr.value - ttl) < Math.abs(prev.value - ttl) ? curr : prev
    );
    return closest.value.toString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cache Settings</DialogTitle>
          <DialogDescription>
            Configure how long AI-generated content is cached before being refreshed.
            Use the Refresh button in each view to bypass cache.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="briefing-ttl" className="text-sm font-medium">
              Briefing cache duration
            </label>
            <Select
              value={findClosestOption(localCacheTTL.briefingTTLMinutes)}
              onValueChange={(value) =>
                updateLocalCacheTTL({ briefingTTLMinutes: parseInt(value) })
              }
            >
              <SelectTrigger id="briefing-ttl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TTL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Default: 1 hour
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="summary-ttl" className="text-sm font-medium">
              Summary cache duration
            </label>
            <Select
              value={findClosestOption(localCacheTTL.summaryTTLMinutes)}
              onValueChange={(value) =>
                updateLocalCacheTTL({ summaryTTLMinutes: parseInt(value) })
              }
            >
              <SelectTrigger id="summary-ttl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TTL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Default: 6 hours
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="contacts-ttl" className="text-sm font-medium">
              Contacts cache duration
            </label>
            <Select
              value={findClosestOption(localCacheTTL.contactsTTLMinutes)}
              onValueChange={(value) =>
                updateLocalCacheTTL({ contactsTTLMinutes: parseInt(value) })
              }
            >
              <SelectTrigger id="contacts-ttl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TTL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Default: 7 days
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="w-full"
          >
            Reset to Defaults
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

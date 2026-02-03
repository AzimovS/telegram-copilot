import { useEffect, useState } from "react";
import { useSettingsStore, type ChatFilterSettings } from "@/stores/settingsStore";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getFolders } from "@/lib/tauri";
import type { Folder } from "@/types/telegram";

// Slider uses 1001 to represent "No limit"
const NO_LIMIT_VALUE = 1001;
const SLIDER_MIN = 0;
const SLIDER_MAX = NO_LIMIT_VALUE;
const SLIDER_STEP = 10;

function formatRangeDisplay(range: [number, number] | null): string {
  if (!range) return "No limit";
  const [min, max] = range;
  const minStr = min.toString();
  const maxStr = max >= NO_LIMIT_VALUE ? "No limit" : max.toString();
  return `${minStr} - ${maxStr}`;
}

function rangeToSliderValues(range: [number, number] | null): [number, number] {
  if (!range) return [SLIDER_MIN, NO_LIMIT_VALUE];
  return range;
}

function sliderValuesToRange(values: number[]): [number, number] | null {
  const [min, max] = values;
  // If both are at their extremes, treat as "no limit"
  if (min === SLIDER_MIN && max >= NO_LIMIT_VALUE) {
    return null;
  }
  return [min, max >= NO_LIMIT_VALUE ? NO_LIMIT_VALUE : max];
}

interface ChatFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatFiltersDialog({ open, onOpenChange }: ChatFiltersDialogProps) {
  const { chatFilters, setChatFilters } = useSettingsStore();
  const [localFilters, setLocalFilters] = useState<ChatFilterSettings>(chatFilters);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalFilters(chatFilters);
      setFoldersLoading(true);
      setFoldersError(null);
      getFolders()
        .then(setFolders)
        .catch((err) => setFoldersError(err?.message || "Failed to load folders"))
        .finally(() => setFoldersLoading(false));
    }
  }, [open, chatFilters]);

  const updateLocalFilters = (updates: Partial<ChatFilterSettings>) => {
    setLocalFilters((prev) => ({ ...prev, ...updates }));
  };

  const handleRangeSliderChange = (values: number[]) => {
    updateLocalFilters({ groupSizeRange: sliderValuesToRange(values) });
  };

  const handleFolderToggle = (folderId: number) => {
    const currentIds = localFilters.selectedFolderIds;
    const newIds = currentIds.includes(folderId)
      ? currentIds.filter((id) => id !== folderId)
      : [...currentIds, folderId];
    updateLocalFilters({ selectedFolderIds: newIds });
  };

  const handleApply = () => {
    setChatFilters(localFilters);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalFilters(chatFilters); // Reset to original
    onOpenChange(false);
  };

  const sliderValues = rangeToSliderValues(localFilters.groupSizeRange);
  const displayValue = formatRangeDisplay(localFilters.groupSizeRange);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chat Filters</DialogTitle>
          <DialogDescription>
            Select which types of chats to show in Briefing, Summary, and Chats views
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          {/* Telegram Folders Section - Priority: folder chats bypass all filters below */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Telegram Folders</h4>
            <div className="p-3 rounded-lg border border-border bg-background">
              {foldersLoading ? (
                <p className="text-sm text-muted-foreground">Loading folders...</p>
              ) : foldersError ? (
                <p className="text-sm text-destructive">{foldersError}</p>
              ) : folders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No folders found. Create folders in Telegram to filter by them.</p>
              ) : (
                <div className="space-y-2">
                  {folders.map((folder) => (
                    <label
                      key={folder.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={localFilters.selectedFolderIds.includes(folder.id)}
                        onCheckedChange={() => handleFolderToggle(folder.id)}
                      />
                      <span className="text-sm">
                        {folder.emoticon && <span className="mr-2">{folder.emoticon}</span>}
                        {folder.title}
                      </span>
                    </label>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2">
                    {localFilters.selectedFolderIds.length === 0
                      ? "No folders selected = apply filters below to all chats"
                      : "Chats from selected folders always show, regardless of filters below"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Chat Types Section */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Chat Types</h4>
            <div className="space-y-2">
              {/* Contacts */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background hover:bg-accent/50 cursor-pointer transition-colors">
                <Checkbox
                  checked={localFilters.includePrivateChats}
                  onCheckedChange={(checked) => updateLocalFilters({ includePrivateChats: !!checked })}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-0.5">
                  <div className="text-sm font-medium leading-none">Contacts</div>
                  <div className="text-xs text-muted-foreground">
                    Direct messages with people in your contacts
                  </div>
                </div>
              </label>

              {/* Non-contacts */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background hover:bg-accent/50 cursor-pointer transition-colors">
                <Checkbox
                  checked={localFilters.includeNonContacts}
                  onCheckedChange={(checked) => updateLocalFilters({ includeNonContacts: !!checked })}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-0.5">
                  <div className="text-sm font-medium leading-none">Non-contacts</div>
                  <div className="text-xs text-muted-foreground">
                    Direct messages with people not in your contacts
                  </div>
                </div>
              </label>

              {/* Groups with nested range slider */}
              <div className="rounded-lg border border-border bg-background">
                <label className="flex items-start gap-3 p-3 hover:bg-accent/50 cursor-pointer transition-colors">
                  <Checkbox
                    checked={localFilters.includeGroups}
                    onCheckedChange={(checked) => updateLocalFilters({ includeGroups: !!checked })}
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-0.5">
                    <div className="text-sm font-medium leading-none">Groups</div>
                    <div className="text-xs text-muted-foreground">
                      Group conversations and supergroups
                    </div>
                  </div>
                </label>
                {/* Nested: Member range slider */}
                {localFilters.includeGroups && (
                  <div className="p-3 pl-9 border-t border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Member range:</span>
                      <span className="text-sm font-medium tabular-nums">{displayValue}</span>
                    </div>
                    <Slider
                      value={sliderValues}
                      onValueChange={handleRangeSliderChange}
                      min={SLIDER_MIN}
                      max={SLIDER_MAX}
                      step={SLIDER_STEP}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0</span>
                      <span>500</span>
                      <span>1000</span>
                      <span>No limit</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Channels */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background hover:bg-accent/50 cursor-pointer transition-colors">
                <Checkbox
                  checked={localFilters.includeChannels}
                  onCheckedChange={(checked) => updateLocalFilters({ includeChannels: !!checked })}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-0.5">
                  <div className="text-sm font-medium leading-none">Channels</div>
                  <div className="text-xs text-muted-foreground">
                    Broadcast channels and news
                  </div>
                </div>
              </label>

              {/* Bots */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background hover:bg-accent/50 cursor-pointer transition-colors">
                <Checkbox
                  checked={localFilters.includeBots}
                  onCheckedChange={(checked) => updateLocalFilters({ includeBots: !!checked })}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-0.5">
                  <div className="text-sm font-medium leading-none">Bots</div>
                  <div className="text-xs text-muted-foreground">
                    Automated bot conversations
                  </div>
                </div>
              </label>

              {/* Archived */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background hover:bg-accent/50 cursor-pointer transition-colors">
                <Checkbox
                  checked={localFilters.includeArchived}
                  onCheckedChange={(checked) => updateLocalFilters({ includeArchived: !!checked })}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-0.5">
                  <div className="text-sm font-medium leading-none">Archived chats</div>
                  <div className="text-xs text-muted-foreground">
                    Chats you've archived
                  </div>
                </div>
              </label>

              {/* Muted */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background hover:bg-accent/50 cursor-pointer transition-colors">
                <Checkbox
                  checked={localFilters.includeMuted}
                  onCheckedChange={(checked) => updateLocalFilters({ includeMuted: !!checked })}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-0.5">
                  <div className="text-sm font-medium leading-none">Muted chats</div>
                  <div className="text-xs text-muted-foreground">
                    Chats with notifications disabled
                  </div>
                </div>
              </label>
            </div>
          </div>

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

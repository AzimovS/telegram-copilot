import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
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

export function ChatFilterStep() {
  const { chatFilters, setChatFilters } = useSettingsStore();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [foldersError, setFoldersError] = useState<string | null>(null);

  useEffect(() => {
    getFolders()
      .then(setFolders)
      .catch((err) => setFoldersError(err?.message || "Failed to load folders"))
      .finally(() => setFoldersLoading(false));
  }, []);

  const handleRangeSliderChange = (values: number[]) => {
    setChatFilters({ groupSizeRange: sliderValuesToRange(values) });
  };

  const handleFolderToggle = (folderId: number) => {
    const currentIds = chatFilters.selectedFolderIds;
    const newIds = currentIds.includes(folderId)
      ? currentIds.filter((id) => id !== folderId)
      : [...currentIds, folderId];
    setChatFilters({ selectedFolderIds: newIds });
  };

  const sliderValues = rangeToSliderValues(chatFilters.groupSizeRange);
  const displayValue = formatRangeDisplay(chatFilters.groupSizeRange);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Welcome to Telegram Copilot!</h2>
        <p className="text-muted-foreground">
          Select the types of chats to show in Briefing, Summary, and Chats views
        </p>
      </div>

      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
        {/* Telegram Folders Section */}
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
                      checked={chatFilters.selectedFolderIds.includes(folder.id)}
                      onCheckedChange={() => handleFolderToggle(folder.id)}
                    />
                    <span className="text-sm">
                      {folder.emoticon && <span className="mr-2">{folder.emoticon}</span>}
                      {folder.title}
                    </span>
                  </label>
                ))}
                <p className="text-xs text-muted-foreground mt-2">
                  {chatFilters.selectedFolderIds.length === 0
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
                checked={chatFilters.includePrivateChats}
                onCheckedChange={(checked) => setChatFilters({ includePrivateChats: !!checked })}
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
                checked={chatFilters.includeNonContacts}
                onCheckedChange={(checked) => setChatFilters({ includeNonContacts: !!checked })}
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
                  checked={chatFilters.includeGroups}
                  onCheckedChange={(checked) => setChatFilters({ includeGroups: !!checked })}
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
              {chatFilters.includeGroups && (
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
                    aria-label="Group member range"
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
                checked={chatFilters.includeChannels}
                onCheckedChange={(checked) => setChatFilters({ includeChannels: !!checked })}
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
                checked={chatFilters.includeBots}
                onCheckedChange={(checked) => setChatFilters({ includeBots: !!checked })}
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
                checked={chatFilters.includeArchived}
                onCheckedChange={(checked) => setChatFilters({ includeArchived: !!checked })}
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
                checked={chatFilters.includeMuted}
                onCheckedChange={(checked) => setChatFilters({ includeMuted: !!checked })}
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
    </div>
  );
}

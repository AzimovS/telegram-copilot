import { useSettingsStore } from "@/stores/settingsStore";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

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

  const handleRangeSliderChange = (values: number[]) => {
    setChatFilters({ groupSizeRange: sliderValuesToRange(values) });
  };

  const sliderValues = rangeToSliderValues(chatFilters.groupSizeRange);
  const displayValue = formatRangeDisplay(chatFilters.groupSizeRange);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Which chats should be included?</h2>
        <p className="text-muted-foreground">
          Select the types of chats to show in Briefing, Summary, and Chats views
        </p>
      </div>

      <div className="space-y-3">
        {/* Private Chats with nested non-contacts */}
        <div className="rounded-lg border border-border bg-background">
          <label className="flex items-start gap-3 p-4 hover:bg-accent/50 cursor-pointer transition-colors">
            <Checkbox
              checked={chatFilters.includePrivateChats}
              onCheckedChange={(checked) => setChatFilters({ includePrivateChats: !!checked })}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1">
              <div className="font-medium leading-none">Private chats (DMs)</div>
              <div className="text-sm text-muted-foreground">
                Direct messages with individual users
              </div>
            </div>
          </label>
          {/* Nested: Include non-contacts */}
          {chatFilters.includePrivateChats && (
            <label className="flex items-start gap-3 p-4 pl-10 border-t border-border hover:bg-accent/50 cursor-pointer transition-colors">
              <Checkbox
                checked={chatFilters.includeNonContacts}
                onCheckedChange={(checked) => setChatFilters({ includeNonContacts: !!checked })}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <div className="font-medium leading-none">Include non-contacts</div>
                <div className="text-sm text-muted-foreground">
                  DMs with people not in your contacts
                </div>
              </div>
            </label>
          )}
        </div>

        {/* Groups with nested range slider */}
        <div className="rounded-lg border border-border bg-background">
          <label className="flex items-start gap-3 p-4 hover:bg-accent/50 cursor-pointer transition-colors">
            <Checkbox
              checked={chatFilters.includeGroups}
              onCheckedChange={(checked) => setChatFilters({ includeGroups: !!checked })}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-1">
              <div className="font-medium leading-none">Groups</div>
              <div className="text-sm text-muted-foreground">
                Group conversations and supergroups
              </div>
            </div>
          </label>
          {/* Nested: Member range slider */}
          {chatFilters.includeGroups && (
            <div className="p-4 pl-10 border-t border-border space-y-3">
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
              <p className="text-xs text-muted-foreground">
                Filter groups by member count. Drag both handles to set a range.
              </p>
            </div>
          )}
        </div>

        {/* Channels */}
        <label className="flex items-start gap-3 p-4 rounded-lg border border-border bg-background hover:bg-accent/50 cursor-pointer transition-colors">
          <Checkbox
            checked={chatFilters.includeChannels}
            onCheckedChange={(checked) => setChatFilters({ includeChannels: !!checked })}
            className="mt-0.5"
          />
          <div className="flex-1 space-y-1">
            <div className="font-medium leading-none">Channels</div>
            <div className="text-sm text-muted-foreground">
              Broadcast channels and news
            </div>
          </div>
        </label>

        {/* Bots */}
        <label className="flex items-start gap-3 p-4 rounded-lg border border-border bg-background hover:bg-accent/50 cursor-pointer transition-colors">
          <Checkbox
            checked={chatFilters.includeBots}
            onCheckedChange={(checked) => setChatFilters({ includeBots: !!checked })}
            className="mt-0.5"
          />
          <div className="flex-1 space-y-1">
            <div className="font-medium leading-none">Bots</div>
            <div className="text-sm text-muted-foreground">
              Automated bot conversations
            </div>
          </div>
        </label>

        {/* Archived */}
        <label className="flex items-start gap-3 p-4 rounded-lg border border-border bg-background hover:bg-accent/50 cursor-pointer transition-colors">
          <Checkbox
            checked={chatFilters.includeArchived}
            onCheckedChange={(checked) => setChatFilters({ includeArchived: !!checked })}
            className="mt-0.5"
          />
          <div className="flex-1 space-y-1">
            <div className="font-medium leading-none">Archived chats</div>
            <div className="text-sm text-muted-foreground">
              Chats you've archived
            </div>
          </div>
        </label>

        {/* Muted */}
        <label className="flex items-start gap-3 p-4 rounded-lg border border-border bg-background hover:bg-accent/50 cursor-pointer transition-colors">
          <Checkbox
            checked={chatFilters.includeMuted}
            onCheckedChange={(checked) => setChatFilters({ includeMuted: !!checked })}
            className="mt-0.5"
          />
          <div className="flex-1 space-y-1">
            <div className="font-medium leading-none">Muted chats</div>
            <div className="text-sm text-muted-foreground">
              Chats with notifications disabled
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}

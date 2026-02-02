import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Users,
  Radio,
  ArrowUpDown,
} from "lucide-react";
import {
  ChatTypeFilter,
  TimeFilter,
  SortOption,
  typeFilters,
  timeFilters,
  sortOptions,
} from "./types";

interface SummaryFiltersProps {
  typeFilter: ChatTypeFilter;
  setTypeFilter: (value: ChatTypeFilter) => void;
  timeFilter: TimeFilter;
  setTimeFilter: (value: TimeFilter) => void;
  sortBy: SortOption;
  setSortBy: (value: SortOption) => void;
  needsResponseOnly: boolean;
  setNeedsResponseOnly: (value: boolean) => void;
}

const getTypeFilterIcon = (value: ChatTypeFilter) => {
  switch (value) {
    case "private":
      return <MessageSquare className="h-3 w-3" />;
    case "group":
      return <Users className="h-3 w-3" />;
    case "channel":
      return <Radio className="h-3 w-3" />;
    default:
      return null;
  }
};

export function SummaryFilters({
  typeFilter,
  setTypeFilter,
  timeFilter,
  setTimeFilter,
  sortBy,
  setSortBy,
  needsResponseOnly,
  setNeedsResponseOnly,
}: SummaryFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Type Filter */}
      <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ChatTypeFilter)}>
        <SelectTrigger className="h-8 w-[120px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {typeFilters.map((filter) => (
            <SelectItem key={filter.value} value={filter.value} className="text-xs">
              <span className="flex items-center gap-1">
                {getTypeFilterIcon(filter.value)}
                {filter.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Time Filter */}
      <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
        <SelectTrigger className="h-8 w-[110px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {timeFilters.map((filter) => (
            <SelectItem key={filter.value} value={filter.value} className="text-xs">
              {filter.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort Dropdown */}
      <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <ArrowUpDown className="h-3 w-3 text-muted-foreground mr-1" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Needs Response Filter */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="needsResponse"
          checked={needsResponseOnly}
          onCheckedChange={(checked) => setNeedsResponseOnly(checked === true)}
        />
        <label htmlFor="needsResponse" className="text-sm cursor-pointer">
          Needs Response Only
        </label>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  RefreshCw,
  Loader2,
  Search,
  Package,
} from "lucide-react";
import type { ContactSortOption, ContactFilters } from "@/types/contacts";

interface ContactsToolbarProps {
  totalCount: number;
  cached: boolean;
  cacheAge: string | null;
  isRefreshing: boolean;
  filters: ContactFilters;
  sortOption: ContactSortOption;
  allTags: string[];
  onFiltersChange: (filters: Partial<ContactFilters>) => void;
  onSortChange: (sort: ContactSortOption) => void;
  onRefresh: () => void;
}

const sortOptions: { value: ContactSortOption; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "name", label: "A-Z" },
  { value: "unread", label: "Unread" },
];

export function ContactsToolbar({
  totalCount,
  cached,
  cacheAge,
  isRefreshing,
  filters,
  sortOption,
  allTags,
  onFiltersChange,
  onSortChange,
  onRefresh,
}: ContactsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 border-b">
      {/* Title */}
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <span className="font-semibold">Contacts ({totalCount})</span>
      </div>

      {/* Cache Badge */}
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Package className="h-3 w-3" />
        {cached ? (cacheAge ? `Cached ${cacheAge}` : "Cached") : "Fresh"}
      </span>

      {/* Refresh Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
      </Button>

      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={filters.searchQuery}
          onChange={(e) => onFiltersChange({ searchQuery: e.target.value })}
          className="pl-8 h-8"
        />
      </div>

      {/* Tag Filter */}
      <Select
        value={filters.selectedTag || "all"}
        onValueChange={(v) => onFiltersChange({ selectedTag: v === "all" ? null : v })}
      >
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="All Tags" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Tags</SelectItem>
          {allTags.map((tag) => (
            <SelectItem key={tag} value={tag}>
              {tag}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort Dropdown */}
      <Select value={sortOption} onValueChange={(v) => onSortChange(v as ContactSortOption)}>
        <SelectTrigger className="h-8 w-[100px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

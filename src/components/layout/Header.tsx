import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  title: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onFilterClick?: () => void;
  showFilter?: boolean;
}

export function Header({
  title,
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  onFilterClick,
  showFilter = false,
}: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <h1 className="text-lg font-semibold">{title}</h1>

      <div className="flex items-center gap-2">
        {onSearchChange && (
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-64"
          />
        )}
        {showFilter && onFilterClick && (
          <Button variant="outline" size="icon" onClick={onFilterClick}>
            <Filter className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}

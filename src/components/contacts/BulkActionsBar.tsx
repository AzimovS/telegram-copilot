import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Loader2 } from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  allTags: string[];
  isDeleting: boolean;
  onBulkAddTag: (ids: number[], tag: string) => Promise<void>;
  onBulkDelete: () => Promise<void>;
  onClearSelection: () => void;
  selectedIds: number[];
}

export function BulkActionsBar({
  selectedCount,
  allTags,
  isDeleting,
  onBulkAddTag,
  onBulkDelete,
  onClearSelection,
  selectedIds,
}: BulkActionsBarProps) {
  const [bulkTagToAdd, setBulkTagToAdd] = useState<string>("");

  const handleBulkTag = async () => {
    if (bulkTagToAdd && selectedIds.length > 0) {
      await onBulkAddTag(selectedIds, bulkTagToAdd);
      setBulkTagToAdd("");
    }
  };

  const handleBulkDelete = async () => {
    const confirmed = window.confirm(
      `Delete ${selectedCount} contacts from Telegram? This cannot be undone.`
    );
    if (confirmed) {
      await onBulkDelete();
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border-b">
      <span className="text-sm font-medium">{selectedCount} selected</span>

      {/* Tag Dropdown */}
      <Select value={bulkTagToAdd} onValueChange={setBulkTagToAdd}>
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="Add tag..." />
        </SelectTrigger>
        <SelectContent>
          {allTags.map((tag) => (
            <SelectItem key={tag} value={tag}>
              {tag}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        variant="secondary"
        onClick={handleBulkTag}
        disabled={!bulkTagToAdd}
      >
        Apply Tag
      </Button>

      <Button
        size="sm"
        variant="destructive"
        onClick={handleBulkDelete}
        disabled={isDeleting}
      >
        {isDeleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        <span className="ml-1">Delete</span>
      </Button>

      <Button size="sm" variant="ghost" onClick={onClearSelection}>
        Clear
      </Button>
    </div>
  );
}

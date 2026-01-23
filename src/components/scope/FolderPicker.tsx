import { useScopeStore } from "@/stores/scopeStore";
import { cn } from "@/lib/utils";
import { Folder, Check } from "lucide-react";
import type { Folder as FolderType } from "@/types/telegram";

interface FolderPickerProps {
  folders: FolderType[];
  selectedIds: number[];
}

export function FolderPicker({ folders, selectedIds }: FolderPickerProps) {
  const { toggleFolder } = useScopeStore();

  if (folders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No folders found. Create folders in Telegram to organize your chats.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {folders.map((folder) => {
        const isSelected = selectedIds.includes(folder.id);
        return (
          <button
            key={folder.id}
            onClick={() => toggleFolder(folder.id)}
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg border text-left transition-colors",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              {isSelected ? (
                <Check className="h-4 w-4" />
              ) : (
                <Folder className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{folder.title}</p>
              <p className="text-xs text-muted-foreground">
                {folder.includedChatIds.length} chats
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

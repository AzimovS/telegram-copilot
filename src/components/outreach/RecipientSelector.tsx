import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/common/SearchInput";
import { cn } from "@/lib/utils";
import { Check, Users } from "lucide-react";
import type { Contact } from "@/types/contacts";

interface RecipientSelectorProps {
  contacts: Contact[];
  selectedIds: number[];
  allTags: string[];
  onToggle: (id: number) => void;
  onSelectByTag: (tag: string) => void;
  onClearAll: () => void;
}

export function RecipientSelector({
  contacts,
  selectedIds,
  allTags,
  onToggle,
  onSelectByTag,
  onClearAll,
}: RecipientSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
    return (
      fullName.includes(query) ||
      contact.username?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      {/* Tag Selection */}
      <div>
        <h4 className="text-sm font-medium mb-2">Select by tag</h4>
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <Button
              key={tag}
              variant="outline"
              size="sm"
              onClick={() => onSelectByTag(tag)}
              className="h-7"
            >
              <Users className="h-3 w-3 mr-1" />
              {tag}
            </Button>
          ))}
          {allTags.length === 0 && (
            <span className="text-sm text-muted-foreground">
              No tags available
            </span>
          )}
        </div>
      </div>

      {/* Selection Status */}
      <div className="flex items-center justify-between">
        <span className="text-sm">
          <span className="font-medium">{selectedIds.length}</span> recipient
          {selectedIds.length !== 1 ? "s" : ""} selected
        </span>
        {selectedIds.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            Clear all
          </Button>
        )}
      </div>

      {/* Search */}
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search contacts..."
      />

      {/* Contact List */}
      <div className="max-h-[300px] overflow-y-auto border rounded-md">
        {filteredContacts.map((contact) => {
          const isSelected = selectedIds.includes(contact.userId);
          const fullName = `${contact.firstName} ${contact.lastName}`.trim();

          return (
            <div
              key={contact.userId}
              className={cn(
                "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 border-b last:border-b-0",
                isSelected && "bg-primary/5"
              )}
              onClick={() => onToggle(contact.userId)}
            >
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded border",
                  isSelected
                    ? "bg-primary border-primary"
                    : "border-muted-foreground"
                )}
              >
                {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{fullName}</p>
                {contact.username && (
                  <p className="text-xs text-muted-foreground">
                    @{contact.username}
                  </p>
                )}
              </div>
              {contact.tags.length > 0 && (
                <div className="flex gap-1">
                  {contact.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs rounded-full bg-secondary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filteredContacts.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No contacts found
          </div>
        )}
      </div>
    </div>
  );
}

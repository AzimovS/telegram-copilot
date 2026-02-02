import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Contact } from "@/types/contacts";

interface ContactsPanelProps {
  contacts: Contact[];
  selectedIds: number[];
  allTags: string[];
  isLoading: boolean;
  onToggle: (id: number) => void;
  onSelectAll: (ids: number[]) => void;
  onClearAll: () => void;
}

export function ContactsPanel({
  contacts,
  selectedIds,
  allTags,
  isLoading,
  onToggle,
  onSelectAll,
  onClearAll,
}: ContactsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      !searchQuery ||
      `${contact.firstName} ${contact.lastName}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      contact.username?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTag =
      !selectedTag || contact.tags.includes(selectedTag);

    return matchesSearch && matchesTag;
  });

  const filteredIds = filteredContacts.map((c) => c.userId);
  const selectedCount = selectedIds.length;

  const handleSelectAll = () => {
    onSelectAll(filteredIds);
  };

  const handleCheckboxClick = (e: React.MouseEvent, userId: number) => {
    e.stopPropagation();
    onToggle(userId);
  };

  return (
    <div className="w-[350px] flex flex-col border-r overflow-hidden">
      {/* Filter Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
        <Select
          value={selectedTag || "all"}
          onValueChange={(v) => setSelectedTag(v === "all" ? null : v)}
        >
          <SelectTrigger className="h-8 w-[100px] text-xs">
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
      </div>

      {/* Selection Actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium">{selectedCount} selected</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={handleSelectAll}>
          All
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          disabled={selectedCount === 0}
        >
          Clear
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && contacts.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Loading contacts...</p>
          </div>
        </div>
      )}

      {/* Contact List */}
      {!isLoading && (
        <div className="flex-1 overflow-y-auto">
          {filteredContacts.map((contact) => {
            const fullName = `${contact.firstName} ${contact.lastName}`.trim();
            const isChecked = selectedIds.includes(contact.userId);

            return (
              <div
                key={contact.userId}
                className={cn(
                  "grid grid-cols-[30px_1fr] gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors border-b",
                  isChecked && "bg-primary/5"
                )}
                onClick={() => onToggle(contact.userId)}
              >
                {/* Checkbox */}
                <div
                  className="flex items-center justify-center"
                  onClick={(e) => handleCheckboxClick(e, contact.userId)}
                >
                  <Checkbox checked={isChecked} />
                </div>

                {/* Name & Username */}
                <div className="min-w-0">
                  <div className="font-medium truncate text-sm">{fullName}</div>
                  {contact.username && (
                    <div className="text-xs text-muted-foreground truncate">
                      @{contact.username}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filteredContacts.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No contacts found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

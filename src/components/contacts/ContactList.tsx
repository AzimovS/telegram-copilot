import { VirtualList } from "@/components/common/VirtualList";
import { SearchInput } from "@/components/common/SearchInput";
import { ContactCard } from "./ContactCard";
import { Button } from "@/components/ui/button";
import type { Contact, ContactSortField, SortDirection } from "@/types/contacts";
import { Loader2, ArrowUpDown, Filter } from "lucide-react";

interface ContactListProps {
  contacts: Contact[];
  selectedContactId: number | null;
  onSelectContact: (userId: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortField: ContactSortField;
  sortDirection: SortDirection;
  onSortChange: (field: ContactSortField, direction: SortDirection) => void;
  onFilterClick: () => void;
  isLoading: boolean;
}

const sortOptions: { value: ContactSortField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "lastContact", label: "Last Contact" },
  { value: "daysSinceContact", label: "Days Since" },
  { value: "tagCount", label: "Tag Count" },
];

export function ContactList({
  contacts,
  selectedContactId,
  onSelectContact,
  searchQuery,
  onSearchChange,
  sortField,
  sortDirection,
  onSortChange,
  onFilterClick,
  isLoading,
}: ContactListProps) {
  const handleSortClick = () => {
    // Cycle through sort options
    const currentIndex = sortOptions.findIndex((o) => o.value === sortField);
    const nextIndex = (currentIndex + 1) % sortOptions.length;
    onSortChange(sortOptions[nextIndex].value, sortDirection);
  };

  const toggleDirection = () => {
    onSortChange(sortField, sortDirection === "asc" ? "desc" : "asc");
  };

  if (isLoading && contacts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search and Sort */}
      <div className="p-3 border-b space-y-2">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search contacts..."
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSortClick}
              className="h-8"
            >
              <ArrowUpDown className="h-3 w-3 mr-1" />
              {sortOptions.find((o) => o.value === sortField)?.label}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDirection}
              className="h-8 px-2"
            >
              {sortDirection === "asc" ? "↑" : "↓"}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onFilterClick}
            className="h-8"
          >
            <Filter className="h-3 w-3 mr-1" />
            Filter
          </Button>
        </div>
      </div>

      {/* Contact count */}
      <div className="px-3 py-2 text-sm text-muted-foreground border-b">
        {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
      </div>

      {/* Contact List */}
      {contacts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          {searchQuery ? "No contacts found" : "No contacts yet"}
        </div>
      ) : (
        <VirtualList
          items={contacts}
          estimateSize={80}
          className="flex-1"
          renderItem={(contact) => (
            <ContactCard
              key={contact.userId}
              contact={contact}
              isSelected={contact.userId === selectedContactId}
              onClick={() => onSelectContact(contact.userId)}
            />
          )}
        />
      )}
    </div>
  );
}

import { useState } from "react";
import { useContacts } from "@/hooks/useContacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Trash2,
  X,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  Info,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Contact, ContactSortOption } from "@/types/contacts";

interface ContactsViewProps {
  onOpenChat: (chatId: number) => void;
}

const sortOptions: { value: ContactSortOption; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "name", label: "A-Z" },
  { value: "unread", label: "Unread" },
];

export function ContactsView({ onOpenChat }: ContactsViewProps) {
  const {
    contacts,
    allContacts,
    selectedContact,
    selectedContactId,
    selectedIds,
    filters,
    sortOption,
    allTags,
    isLoading,
    isRefreshing,
    isDeleting,
    error,
    warning,
    cached,
    cacheAge,
    neverContactedCount,
    selectContact,
    toggleSelectId,
    selectAllFiltered,
    clearSelection,
    addTag,
    removeTag,
    bulkAddTag,
    deleteContacts,
    setFilters,
    setSortOption,
    refresh,
    clearError,
    clearWarning,
  } = useContacts();

  const [bulkTagToAdd, setBulkTagToAdd] = useState<string>("");
  const [detailTagToAdd, setDetailTagToAdd] = useState<string>("");

  const formatDate = (daysSince: number | undefined): string => {
    if (daysSince === undefined || daysSince === null) return "Never";
    if (daysSince === 0) return "Today";
    return `${daysSince}d ago`;
  };

  const handleBulkTag = async () => {
    if (bulkTagToAdd && selectedIds.length > 0) {
      await bulkAddTag(selectedIds, bulkTagToAdd);
      setBulkTagToAdd("");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${selectedIds.length} contacts from Telegram? This cannot be undone.`
    );
    if (confirmed) {
      const success = await deleteContacts(selectedIds);
      if (success) {
        alert(`Deleted ${selectedIds.length} contacts`);
      }
    }
  };

  const handleAddDetailTag = async () => {
    if (detailTagToAdd && selectedContact) {
      await addTag(selectedContact.userId, detailTagToAdd);
      setDetailTagToAdd("");
    }
  };

  const handleRowClick = (contact: Contact) => {
    selectContact(contact.userId);
  };

  const handleCheckboxClick = (e: React.MouseEvent, userId: number) => {
    e.stopPropagation();
    toggleSelectId(userId);
  };

  const handleHeaderCheckboxClick = () => {
    const filteredIds = contacts.map((c) => c.userId);
    selectAllFiltered(filteredIds);
  };

  const isAllSelected = contacts.length > 0 && contacts.every((c) => selectedIds.includes(c.userId));

  // Tags not already on selected contact (for detail panel dropdown)
  const availableTagsForDetail = selectedContact
    ? allTags.filter((t) => !selectedContact.tags.includes(t))
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b">
        {/* Title */}
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <span className="font-semibold">Contacts ({allContacts.length})</span>
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
          onClick={refresh}
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
            onChange={(e) => setFilters({ searchQuery: e.target.value })}
            className="pl-8 h-8"
          />
        </div>

        {/* Tag Filter */}
        <Select
          value={filters.selectedTag || "all"}
          onValueChange={(v) => setFilters({ selectedTag: v === "all" ? null : v })}
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
        <Select value={sortOption} onValueChange={(v) => setSortOption(v as ContactSortOption)}>
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

      {/* Info Banner - Never Contacted */}
      {neverContactedCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950 border-b text-sm">
          <Info className="h-4 w-4 text-blue-500" />
          <span>
            {neverContactedCount} contacts have never been messaged. Consider cleaning up your contact list.
          </span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <Alert variant="destructive" className="mx-4 mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Failed to load contacts: {error}</span>
            <Button variant="ghost" size="sm" onClick={clearError}>
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Warning Banner */}
      {warning && (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-950 border-b text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <span className="flex-1">{warning}</span>
          <Button variant="ghost" size="sm" onClick={clearWarning}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border-b">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>

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

          <Button size="sm" variant="ghost" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Contact List (Left Column) */}
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          {/* List Header */}
          <div className="grid grid-cols-[30px_1fr_100px_150px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
            <div className="flex items-center justify-center">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={handleHeaderCheckboxClick}
              />
            </div>
            <div>Name</div>
            <div>Last Contact</div>
            <div>Tags</div>
          </div>

          {/* Loading State */}
          {isLoading && contacts.length === 0 && (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-muted-foreground">Loading contacts...</p>
              </div>
            </div>
          )}

          {/* Contact Rows */}
          {!isLoading && (
            <div className="flex-1 overflow-y-auto">
              {contacts.map((contact) => {
                const fullName = `${contact.firstName} ${contact.lastName}`.trim();
                const isSelected = selectedContactId === contact.userId;
                const isChecked = selectedIds.includes(contact.userId);
                const isNeverContacted = contact.daysSinceContact === undefined || contact.daysSinceContact === null;

                return (
                  <div
                    key={contact.userId}
                    className={cn(
                      "grid grid-cols-[30px_1fr_100px_150px] gap-2 px-3 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b",
                      isSelected && "bg-muted border-l-4 border-l-primary",
                      isNeverContacted && "opacity-70"
                    )}
                    onClick={() => handleRowClick(contact)}
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
                      <div className="font-medium truncate">{fullName}</div>
                      {contact.username && (
                        <div className="text-xs text-muted-foreground truncate">
                          @{contact.username}
                        </div>
                      )}
                    </div>

                    {/* Last Contact Date */}
                    <div className={cn(
                      "text-sm",
                      isNeverContacted && "text-red-500"
                    )}>
                      {formatDate(contact.daysSinceContact)}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 items-start">
                      {contact.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                      {contact.tags.length > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{contact.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel (Right Column) */}
        {selectedContact && (
          <div className="w-[350px] flex flex-col overflow-y-auto p-4 space-y-4">
            {/* Header */}
            <div>
              <h3 className="text-lg font-semibold">
                {selectedContact.firstName} {selectedContact.lastName}
              </h3>
              {selectedContact.username && (
                <p className="text-sm text-muted-foreground">@{selectedContact.username}</p>
              )}
            </div>

            {/* Tags Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Tags</span>
              </div>

              {/* Current Tags */}
              <div className="flex flex-wrap gap-1">
                {selectedContact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(selectedContact.userId, tag)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {selectedContact.tags.length === 0 && (
                  <span className="text-xs text-muted-foreground">No tags</span>
                )}
              </div>

              {/* Add Tag */}
              <div className="flex items-center gap-2">
                <Select value={detailTagToAdd} onValueChange={setDetailTagToAdd}>
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue placeholder="Add tag..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTagsForDetail.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {detailTagToAdd && (
                  <Button size="sm" onClick={handleAddDetailTag}>
                    Add
                  </Button>
                )}
              </div>
            </div>

            {/* Stats Section */}
            <div className="space-y-2">
              <span className="text-sm font-medium">Stats</span>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  Last contact:{" "}
                  <span className={cn(
                    "font-medium",
                    (selectedContact.daysSinceContact === undefined || selectedContact.daysSinceContact === null) && "text-red-500"
                  )}>
                    {formatDate(selectedContact.daysSinceContact)}
                  </span>
                </p>
                {selectedContact.unreadCount !== undefined && selectedContact.unreadCount > 0 && (
                  <p>{selectedContact.unreadCount} unread messages</p>
                )}
              </div>
            </div>

            {/* Open Chat Button */}
            <Button className="w-full" onClick={() => onOpenChat(selectedContact.userId)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Open Chat
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

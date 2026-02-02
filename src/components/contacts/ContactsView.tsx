import { useContacts } from "@/hooks/useContacts";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  X,
  AlertCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import type { Contact } from "@/types/contacts";
import { ContactsToolbar } from "./ContactsToolbar";
import { ContactRow } from "./ContactRow";
import { ContactDetailPanel } from "./ContactDetailPanel";
import { BulkActionsBar } from "./BulkActionsBar";

interface ContactsViewProps {
  onOpenChat: (chatId: number) => void;
}

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

  const handleBulkDelete = async () => {
    const success = await deleteContacts(selectedIds);
    if (success) {
      alert(`Deleted ${selectedIds.length} contacts`);
    }
  };

  const isAllSelected =
    contacts.length > 0 && contacts.every((c) => selectedIds.includes(c.userId));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <ContactsToolbar
        totalCount={allContacts.length}
        cached={cached}
        cacheAge={cacheAge}
        isRefreshing={isRefreshing}
        filters={filters}
        sortOption={sortOption}
        allTags={allTags}
        onFiltersChange={setFilters}
        onSortChange={setSortOption}
        onRefresh={refresh}
      />

      {/* Info Banner - Never Contacted */}
      {neverContactedCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950 border-b text-sm">
          <Info className="h-4 w-4 text-blue-500" />
          <span>
            {neverContactedCount} contacts have never been messaged. Consider
            cleaning up your contact list.
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
      <BulkActionsBar
        selectedCount={selectedIds.length}
        allTags={allTags}
        isDeleting={isDeleting}
        onBulkAddTag={bulkAddTag}
        onBulkDelete={handleBulkDelete}
        onClearSelection={clearSelection}
        selectedIds={selectedIds}
      />

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
              {contacts.map((contact) => (
                <ContactRow
                  key={contact.userId}
                  contact={contact}
                  isSelected={selectedContactId === contact.userId}
                  isChecked={selectedIds.includes(contact.userId)}
                  onRowClick={handleRowClick}
                  onCheckboxClick={handleCheckboxClick}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel (Right Column) */}
        {selectedContact && (
          <ContactDetailPanel
            contact={selectedContact}
            allTags={allTags}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            onOpenChat={onOpenChat}
          />
        )}
      </div>
    </div>
  );
}

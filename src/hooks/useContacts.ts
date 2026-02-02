import { useEffect, useMemo } from "react";
import { useContactStore } from "@/stores/contactStore";

export function useContacts() {
  const {
    contacts,
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
    loadContacts,
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
    clearError,
    clearWarning,
    getFilteredContacts,
    getNeverContactedCount,
  } = useContactStore();

  // Load contacts on mount
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Get filtered and sorted contacts
  const filteredContacts = useMemo(() => getFilteredContacts(), [
    contacts,
    filters,
    sortOption,
    getFilteredContacts,
  ]);

  // Get selected contact
  const selectedContact = contacts.find((c) => c.userId === selectedContactId) || null;

  // Get never contacted count
  const neverContactedCount = useMemo(() => getNeverContactedCount(), [
    contacts,
    getNeverContactedCount,
  ]);

  return {
    contacts: filteredContacts,
    allContacts: contacts,
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
    refresh: () => loadContacts(true),
    clearError,
    clearWarning,
  };
}

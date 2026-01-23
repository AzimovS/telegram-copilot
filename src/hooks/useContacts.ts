import { useEffect, useMemo } from "react";
import { useContactStore } from "@/stores/contactStore";

export function useContacts() {
  const {
    contacts,
    selectedContactId,
    filters,
    sortField,
    sortDirection,
    allTags,
    isLoading,
    error,
    loadContacts,
    selectContact,
    addTag,
    removeTag,
    updateNotes,
    setFilters,
    setSorting,
    clearError,
    getFilteredContacts,
  } = useContactStore();

  // Load contacts on mount
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Get filtered and sorted contacts
  const filteredContacts = useMemo(() => getFilteredContacts(), [
    contacts,
    filters,
    sortField,
    sortDirection,
    getFilteredContacts,
  ]);

  // Get selected contact
  const selectedContact = contacts.find((c) => c.userId === selectedContactId) || null;

  return {
    contacts: filteredContacts,
    allContacts: contacts,
    selectedContact,
    selectedContactId,
    filters,
    sortField,
    sortDirection,
    allTags,
    isLoading,
    error,
    selectContact,
    addTag,
    removeTag,
    updateNotes,
    setFilters,
    setSorting,
    refresh: loadContacts,
    clearError,
  };
}

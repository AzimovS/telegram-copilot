import { useOutreachStore } from "@/stores/outreachStore";
import { useContacts } from "@/hooks/useContacts";
import { ContactsPanel } from "./ContactsPanel";
import { HandlesPastePanel } from "./HandlesPastePanel";
import { ComposePanel } from "./ComposePanel";
import { ViewHeader } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

export function OutreachView() {
  const { allContacts, allTags, isLoading: isLoadingContacts } = useContacts();
  const {
    template,
    selectedRecipientIds,
    activeQueue,
    isLoading,
    error,
    inputMode,
    handleInput,
    resolvedHandles,
    isResolving,
    setTemplate,
    selectRecipients,
    toggleRecipient,
    startOutreach,
    startOutreachFromHandles,
    cancelOutreach,
    refreshStatus,
    previewMessage,
    setInputMode,
    setHandleInput,
    resolveHandles,
    removeResolvedHandle,
    clearResolvedHandles,
  } = useOutreachStore();

  const selectedContacts =
    inputMode === "contacts"
      ? allContacts.filter((c) => selectedRecipientIds.includes(c.userId))
      : resolvedHandles
          .filter((h) => h.status === "resolved" && h.userId != null)
          .map((h) => ({
            userId: h.userId!,
            firstName: h.firstName || "",
            lastName: h.lastName || "",
            tags: [] as string[],
            notes: "",
          }));

  const handleSelectAll = (ids: number[]) => {
    const newIds = [...new Set([...selectedRecipientIds, ...ids])];
    selectRecipients(newIds);
  };

  const handleClearAll = () => {
    selectRecipients([]);
  };

  const handleSend =
    inputMode === "contacts" ? startOutreach : startOutreachFromHandles;

  return (
    <div className="flex flex-col h-full">
      <ViewHeader title="Bulk Outreach" />
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column - Mode Toggle + Panel */}
        <div className="w-[350px] flex flex-col border-r overflow-hidden">
          {/* Tab Toggle */}
          <div className="flex border-b">
            <button
              className={cn(
                "flex-1 py-2 text-sm font-medium text-center transition-colors",
                inputMode === "contacts"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setInputMode("contacts")}
            >
              From Contacts
            </button>
            <button
              className={cn(
                "flex-1 py-2 text-sm font-medium text-center transition-colors",
                inputMode === "handles"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setInputMode("handles")}
            >
              Paste Handles
            </button>
          </div>

          {/* Panel Content */}
          {inputMode === "contacts" ? (
            <ContactsPanel
              contacts={allContacts}
              selectedIds={selectedRecipientIds}
              allTags={allTags}
              isLoading={isLoadingContacts}
              onToggle={toggleRecipient}
              onSelectAll={handleSelectAll}
              onClearAll={handleClearAll}
            />
          ) : (
            <HandlesPastePanel
              handleInput={handleInput}
              resolvedHandles={resolvedHandles}
              isResolving={isResolving}
              onInputChange={setHandleInput}
              onResolve={resolveHandles}
              onRemove={removeResolvedHandle}
              onClear={clearResolvedHandles}
            />
          )}
        </div>

        {/* Right Column - Compose Panel */}
        <ComposePanel
          template={template}
          selectedContacts={selectedContacts}
          allContacts={allContacts}
          activeQueue={activeQueue}
          isLoading={isLoading}
          error={error}
          onTemplateChange={setTemplate}
          onSend={handleSend}
          onCancel={cancelOutreach}
          onRefreshStatus={refreshStatus}
          previewMessage={previewMessage}
        />
      </div>
    </div>
  );
}

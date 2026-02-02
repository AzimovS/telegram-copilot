import { useOutreachStore } from "@/stores/outreachStore";
import { useContacts } from "@/hooks/useContacts";
import { ContactsPanel } from "./ContactsPanel";
import { ComposePanel } from "./ComposePanel";
import { ViewHeader } from "@/components/layout/Header";

export function OutreachView() {
  const { allContacts, allTags, isLoading: isLoadingContacts } = useContacts();
  const {
    template,
    selectedRecipientIds,
    activeQueue,
    isLoading,
    error,
    setTemplate,
    selectRecipients,
    toggleRecipient,
    startOutreach,
    cancelOutreach,
    refreshStatus,
    previewMessage,
  } = useOutreachStore();

  const selectedContacts = allContacts.filter((c) =>
    selectedRecipientIds.includes(c.userId)
  );

  const handleSelectAll = (ids: number[]) => {
    const newIds = [...new Set([...selectedRecipientIds, ...ids])];
    selectRecipients(newIds);
  };

  const handleClearAll = () => {
    selectRecipients([]);
  };

  return (
    <div className="flex flex-col h-full">
      <ViewHeader title="Bulk Outreach" />
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column - Contacts Panel */}
        <ContactsPanel
          contacts={allContacts}
          selectedIds={selectedRecipientIds}
          allTags={allTags}
          isLoading={isLoadingContacts}
          onToggle={toggleRecipient}
          onSelectAll={handleSelectAll}
          onClearAll={handleClearAll}
        />

        {/* Right Column - Compose Panel */}
        <ComposePanel
          template={template}
          selectedContacts={selectedContacts}
          allContacts={allContacts}
          activeQueue={activeQueue}
          isLoading={isLoading}
          error={error}
          onTemplateChange={setTemplate}
          onSend={startOutreach}
          onCancel={cancelOutreach}
          onRefreshStatus={refreshStatus}
          previewMessage={previewMessage}
        />
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useTelegramEvents } from "@/hooks/useTelegram";
import { useChats } from "@/hooks/useChats";
import { useContacts } from "@/hooks/useContacts";
import { LoginForm } from "@/components/auth/LoginForm";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { ChatList } from "@/components/chats/ChatList";
import { ChatPanel } from "@/components/chats/ChatPanel";
import { ContactList } from "@/components/contacts/ContactList";
import { TagManager } from "@/components/contacts/TagManager";
import { NotesEditor } from "@/components/contacts/NotesEditor";
import { OutreachPanel } from "@/components/outreach/OutreachPanel";
import { SmartBriefing } from "@/components/briefing/SmartBriefing";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import "@/styles/globals.css";

function ChatsView() {
  const {
    chats,
    selectedChat,
    selectedChatId,
    selectedChatMessages,
    isLoadingChats,
    isLoadingMessages,
    selectChat,
    loadMoreMessages,
    sendMessage,
  } = useChats();

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-80 border-r flex flex-col">
        <ChatList
          chats={chats}
          selectedChatId={selectedChatId}
          onSelectChat={selectChat}
          isLoading={isLoadingChats}
        />
      </div>
      <div className="flex-1 flex flex-col">
        <ChatPanel
          chat={selectedChat}
          messages={selectedChatMessages}
          onSendMessage={sendMessage}
          onLoadMore={loadMoreMessages}
          isLoading={isLoadingMessages}
        />
      </div>
    </div>
  );
}

function ContactsView() {
  const {
    contacts,
    selectedContact,
    selectedContactId,
    filters,
    sortField,
    sortDirection,
    allTags,
    isLoading,
    selectContact,
    addTag,
    removeTag,
    updateNotes,
    setFilters,
    setSorting,
  } = useContacts();

  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Contact List */}
      <div className="w-80 border-r flex flex-col">
        <ContactList
          contacts={contacts}
          selectedContactId={selectedContactId}
          onSelectContact={selectContact}
          searchQuery={filters.searchQuery}
          onSearchChange={(query) => setFilters({ searchQuery: query })}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={setSorting}
          onFilterClick={() => setShowFilters(!showFilters)}
          isLoading={isLoading}
        />
      </div>

      {/* Contact Details */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {selectedContact ? (
          <div className="p-6 space-y-6">
            {/* Contact Header */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-medium text-primary">
                {selectedContact.firstName[0]}
              </div>
              <div>
                <h2 className="text-2xl font-bold">
                  {selectedContact.firstName} {selectedContact.lastName}
                </h2>
                {selectedContact.username && (
                  <p className="text-muted-foreground">
                    @{selectedContact.username}
                  </p>
                )}
              </div>
            </div>

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tags</CardTitle>
                <CardDescription>
                  Organize contacts with custom tags
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TagManager
                  tags={selectedContact.tags}
                  allTags={allTags}
                  onAddTag={(tag) => addTag(selectedContact.userId, tag)}
                  onRemoveTag={(tag) => removeTag(selectedContact.userId, tag)}
                />
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notes</CardTitle>
                <CardDescription>
                  Keep track of important details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NotesEditor
                  notes={selectedContact.notes}
                  onSave={(notes) => updateNotes(selectedContact.userId, notes)}
                />
              </CardContent>
            </Card>

            {/* Last Contact Info */}
            {selectedContact.daysSinceContact !== undefined && (
              <Card>
                <CardContent className="py-4">
                  <p className="text-sm text-muted-foreground">
                    Last contacted{" "}
                    <span className="font-medium text-foreground">
                      {selectedContact.daysSinceContact === 0
                        ? "today"
                        : selectedContact.daysSinceContact === 1
                        ? "yesterday"
                        : `${selectedContact.daysSinceContact} days ago`}
                    </span>
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Select a contact to view details
          </div>
        )}
      </div>
    </div>
  );
}

function OutreachView() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header title="Bulk Outreach" />
      <OutreachPanel />
    </div>
  );
}

function BriefingView() {
  const { selectChat } = useChats();
  const [, setCurrentView] = useState("chats");

  const handleOpenChat = (chatId: number) => {
    selectChat(chatId);
    setCurrentView("chats");
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <SmartBriefing onOpenChat={handleOpenChat} />
    </div>
  );
}

function App() {
  const { authState, checkAuthState } = useAuthStore();
  const [currentView, setCurrentView] = useState("chats");

  useTelegramEvents();

  useEffect(() => {
    checkAuthState();
  }, [checkAuthState]);

  if (authState.type !== "ready") {
    return <LoginForm />;
  }

  const renderView = () => {
    switch (currentView) {
      case "chats":
        return <ChatsView />;
      case "contacts":
        return <ContactsView />;
      case "outreach":
        return <OutreachView />;
      case "briefing":
        return <BriefingView />;
      default:
        return <ChatsView />;
    }
  };

  return (
    <MainLayout currentView={currentView} onViewChange={setCurrentView}>
      {renderView()}
    </MainLayout>
  );
}

export default App;

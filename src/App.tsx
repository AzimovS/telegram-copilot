import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useTelegramEvents } from "@/hooks/useTelegram";
import { useChats } from "@/hooks/useChats";
import { useContacts } from "@/hooks/useContacts";
import { LoginForm } from "@/components/auth/LoginForm";
import { MainLayout } from "@/components/layout/MainLayout";
import { ViewHeader, type ViewType } from "@/components/layout/Header";
import { ChatList } from "@/components/chats/ChatList";
import { ContactList } from "@/components/contacts/ContactList";
import { TagManager } from "@/components/contacts/TagManager";
import { NotesEditor } from "@/components/contacts/NotesEditor";
import { OutreachPanel } from "@/components/outreach/OutreachPanel";
import { SmartBriefing } from "@/components/briefing/SmartBriefing";
import { SummaryView } from "@/components/summary/SummaryView";
import { OffboardView } from "@/components/offboard/OffboardView";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import "@/styles/globals.css";

interface ViewProps {
  onOpenChat: (chatId: number) => void;
}

function ChatsView({ onOpenChat }: ViewProps) {
  const { chats, selectedChatId, selectChat, isLoadingChats } = useChats();

  const handleSelectChat = (chatId: number) => {
    selectChat(chatId);
    onOpenChat(chatId);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col">
        <ChatList
          chats={chats}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          isLoading={isLoadingChats}
        />
      </div>
    </div>
  );
}

function ContactsView({ onOpenChat }: ViewProps) {
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
            <div className="flex items-center justify-between">
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
              <Button onClick={() => onOpenChat(selectedContact.userId)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Open Chat
              </Button>
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
      <ViewHeader title="Bulk Outreach" />
      <OutreachPanel />
    </div>
  );
}

function BriefingView({ onOpenChat }: ViewProps) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <SmartBriefing onOpenChat={onOpenChat} />
    </div>
  );
}

function SummaryViewWrapper({ onOpenChat }: ViewProps) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <SummaryView onOpenChat={onOpenChat} />
    </div>
  );
}

function OffboardViewWrapper({ onOpenChat }: ViewProps) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <OffboardView onOpenChat={onOpenChat} />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <div>
          <h2 className="text-xl font-semibold">Connecting to Telegram</h2>
          <p className="text-muted-foreground">Please wait...</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { authState, isConnecting, connect } = useAuthStore();
  const [currentView, setCurrentView] = useState<ViewType>("briefing");
  const [activeChatId, setActiveChatId] = useState<number | null>(null);

  useTelegramEvents();

  useEffect(() => {
    connect();
  }, [connect]);

  const handleOpenChat = (chatId: number) => {
    setActiveChatId(chatId);
  };

  const handleCloseChat = () => {
    setActiveChatId(null);
  };

  // Show loading screen while connecting
  if (isConnecting) {
    return <LoadingScreen />;
  }

  // Show login form if not authenticated
  if (authState.type !== "ready") {
    return <LoginForm />;
  }

  const renderView = () => {
    switch (currentView) {
      case "briefing":
        return <BriefingView onOpenChat={handleOpenChat} />;
      case "summary":
        return <SummaryViewWrapper onOpenChat={handleOpenChat} />;
      case "chats":
        return <ChatsView onOpenChat={handleOpenChat} />;
      case "contacts":
        return <ContactsView onOpenChat={handleOpenChat} />;
      case "outreach":
        return <OutreachView />;
      case "offboard":
        return <OffboardViewWrapper onOpenChat={handleOpenChat} />;
      default:
        return <BriefingView onOpenChat={handleOpenChat} />;
    }
  };

  return (
    <MainLayout
      currentView={currentView}
      onViewChange={setCurrentView}
      activeChatId={activeChatId}
      onCloseChat={handleCloseChat}
    >
      {renderView()}
    </MainLayout>
  );
}

export default App;

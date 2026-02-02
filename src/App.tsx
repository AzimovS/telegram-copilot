import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useTelegramEvents } from "@/hooks/useTelegram";
import { useChats } from "@/hooks/useChats";
import { LoginForm } from "@/components/auth/LoginForm";
import { MainLayout } from "@/components/layout/MainLayout";
import type { ViewType } from "@/components/layout/Header";
import { ChatList } from "@/components/chats/ChatList";
import { ContactsView } from "@/components/contacts/ContactsView";
import { OutreachView } from "@/components/outreach/OutreachView";
import { BriefingView } from "@/components/briefing/BriefingView";
import { SummaryView } from "@/components/summary/SummaryView";
import { OffboardView } from "@/components/offboard/OffboardView";
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

function ContactsViewWrapper({ onOpenChat }: ViewProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ContactsView onOpenChat={onOpenChat} />
    </div>
  );
}

function OutreachViewWrapper() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <OutreachView />
    </div>
  );
}

function BriefingViewWrapper({ onOpenChat }: ViewProps) {
  // BriefingView expects (chatId, chatName) but we only need chatId
  const handleOpenChat = (chatId: number, _chatName: string) => {
    onOpenChat(chatId);
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <BriefingView onOpenChat={handleOpenChat} />
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
        return <BriefingViewWrapper onOpenChat={handleOpenChat} />;
      case "summary":
        return <SummaryViewWrapper onOpenChat={handleOpenChat} />;
      case "chats":
        return <ChatsView onOpenChat={handleOpenChat} />;
      case "contacts":
        return <ContactsViewWrapper onOpenChat={handleOpenChat} />;
      case "outreach":
        return <OutreachViewWrapper />;
      case "offboard":
        return <OffboardViewWrapper onOpenChat={handleOpenChat} />;
      default:
        return <BriefingViewWrapper onOpenChat={handleOpenChat} />;
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

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useChatStore, DEFAULT_CHAT_LIMIT } from "@/stores/chatStore";
import { useContactStore } from "@/stores/contactStore";
import { useSummaryStore } from "@/stores/summaryStore";
import { useBriefingStore } from "@/stores/briefingStore";
import { chatFiltersFromSettings, getFolders } from "@/lib/tauri";
import type { Folder } from "@/types/telegram";
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
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/styles/globals.css";

interface ViewProps {
  onOpenChat: (chatId: number, chatName?: string, chatType?: string) => void;
}

function ChatsView({ onOpenChat }: ViewProps) {
  const {
    chats,
    selectedChatId,
    selectChat,
    isLoadingChats,
    isLoadingMoreChats,
    hasMoreChats,
    refresh,
    loadMoreChats,
  } = useChats();

  const handleSelectChat = (chatId: number) => {
    selectChat(chatId);
    const chat = chats.find((c) => c.id === chatId);
    onOpenChat(chatId, chat?.title, chat?.type);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col">
        <ChatList
          chats={chats}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          isLoading={isLoadingChats}
          onRefresh={refresh}
          onLoadMore={loadMoreChats}
          hasMore={hasMoreChats}
          isLoadingMore={isLoadingMoreChats}
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
  const handleOpenChat = (chatId: number, chatName: string, chatType?: string) => {
    onOpenChat(chatId, chatName, chatType);
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
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const [currentView, setCurrentView] = useState<ViewType>("briefing");
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [activeChatName, setActiveChatName] = useState<string | undefined>(undefined);
  const [activeChatType, setActiveChatType] = useState<string | undefined>(undefined);
  const [showOnboarding, setShowOnboarding] = useState(!onboardingCompleted);

  useTelegramEvents();

  useEffect(() => {
    connect();
  }, [connect]);

  // Sequential startup pipeline: chats → briefing → summaries
  // Reads settings via getState() to avoid stale closures and unnecessary re-renders.
  useEffect(() => {
    if (authState.type === "ready") {
      const startup = async () => {
        const { chatFilters, cacheTTL } = useSettingsStore.getState();

        let fldrs: Folder[] = [];
        if (chatFilters.selectedFolderIds.length > 0) {
          try { fldrs = await getFolders(); } catch { /* ignore */ }
        }
        const filters = chatFiltersFromSettings(chatFilters, fldrs);

        // Contacts (independent, fire-and-forget)
        useContactStore.getState().loadContacts().catch((e) =>
          console.warn("Background contacts prefetch failed (non-fatal):", e)
        );

        // Step 1: Load 100 chats (single GetDialogs)
        await useChatStore.getState().loadChats(DEFAULT_CHAT_LIMIT, filters);

        // Step 2: Briefing (fetches messages for unread chats + AI)
        // Note: loadBriefing catches errors internally and writes to store.error,
        // so this .catch() only guards against unexpected thrown exceptions.
        await useBriefingStore.getState().loadBriefing({
          filters,
          briefingTTLMinutes: cacheTTL.briefingTTLMinutes,
        }).catch((e) => console.warn("Briefing prefetch failed (non-fatal):", e));

        // Step 3: Summary AI for first 10 chats (reuses cached messages from briefing)
        useSummaryStore.getState().backgroundPrefetchSummaries().catch((e) =>
          console.warn("Background summary prefetch failed (non-fatal):", e)
        );
      };
      startup().catch((e) => console.error("Startup pipeline failed:", e));
    }
  }, [authState.type]);

  // Sync showOnboarding state with store
  useEffect(() => {
    setShowOnboarding(!onboardingCompleted);
  }, [onboardingCompleted]);

  const handleOpenChat = (chatId: number, chatName?: string, chatType?: string) => {
    setActiveChatId(chatId);
    setActiveChatName(chatName);
    setActiveChatType(chatType);
  };

  const handleCloseChat = () => {
    setActiveChatId(null);
    setActiveChatName(undefined);
    setActiveChatType(undefined);
  };

  // Show loading screen while connecting
  if (isConnecting) {
    return <LoadingScreen />;
  }

  // Show login form if not authenticated
  if (authState.type !== "ready") {
    return <LoginForm />;
  }

  // Show onboarding flow for first-time users after login
  if (showOnboarding) {
    return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />;
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
    <TooltipProvider>
      <MainLayout
        currentView={currentView}
        onViewChange={setCurrentView}
        activeChatId={activeChatId}
        activeChatName={activeChatName}
        activeChatType={activeChatType}
        onCloseChat={handleCloseChat}
      >
        {renderView()}
      </MainLayout>
    </TooltipProvider>
  );
}

export default App;

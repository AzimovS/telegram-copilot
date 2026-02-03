import { NavHeader, ViewType } from "./Header";
import { ChatPanel } from "../chat/ChatPanel";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  activeChatId: number | null;
  activeChatName?: string;
  activeChatType?: string;
  onCloseChat: () => void;
}

export function MainLayout({
  children,
  currentView,
  onViewChange,
  activeChatId,
  activeChatName,
  activeChatType,
  onCloseChat,
}: MainLayoutProps) {
  const isChatOpen = activeChatId !== null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <NavHeader currentView={currentView} onViewChange={onViewChange} />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Content */}
        <main
          className={cn(
            "flex flex-1 flex-col overflow-hidden transition-all duration-300",
            isChatOpen && "mr-[400px]"
          )}
        >
          {children}
        </main>

        {/* Chat Panel */}
        <ChatPanel
          chatId={activeChatId}
          chatName={activeChatName}
          chatType={activeChatType}
          onClose={onCloseChat}
        />
      </div>
    </div>
  );
}

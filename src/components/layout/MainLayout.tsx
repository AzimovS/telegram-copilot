import { Sidebar } from "./Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
}

export function MainLayout({
  children,
  currentView,
  onViewChange,
}: MainLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar currentView={currentView} onViewChange={onViewChange} />
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}

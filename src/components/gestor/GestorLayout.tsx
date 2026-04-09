import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { GestorSidebar } from "./GestorSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

export function GestorLayout() {
  const location = useLocation();
  const isDesempenho = location.pathname.startsWith("/gestor/desempenho");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <GestorSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b px-4">
            <div className="flex items-center">
              <SidebarTrigger />
              <span className="ml-3 text-sm text-muted-foreground font-heading hidden sm:inline">Painel do Gestor</span>
            </div>
            <ThemeToggle />
          </header>
          <main className={`flex-1 overflow-auto ${isDesempenho ? "" : "p-3 sm:p-6"}`}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

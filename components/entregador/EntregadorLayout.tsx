import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { EntregadorSidebar } from "./EntregadorSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

export function EntregadorLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <EntregadorSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b border-border px-4">
            <SidebarTrigger />
            <ThemeToggle />
          </header>
          <main className="flex-1 p-3 sm:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { GestorSidebar } from "./GestorSidebar";
import { Outlet } from "react-router-dom";

export function GestorLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <GestorSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b px-4">
            <SidebarTrigger />
            <span className="ml-3 text-sm text-muted-foreground font-heading">Painel do Gestor</span>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

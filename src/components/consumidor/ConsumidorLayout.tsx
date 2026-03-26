import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ConsumidorSidebar } from "@/components/consumidor/ConsumidorSidebar";
import { Outlet } from "react-router-dom";

export function ConsumidorLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <ConsumidorSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b px-4">
            <SidebarTrigger />
            <span className="ml-3 text-sm text-muted-foreground font-heading">Minha Conta</span>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

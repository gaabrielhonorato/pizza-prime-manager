import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { PizzariaSidebar } from "@/components/pizzaria/PizzariaSidebar";
import { Outlet } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MinhaPizzariaProvider } from "@/contexts/MinhaPizzariaContext";

export function PizzariaLayout() {
  return (
    <MinhaPizzariaProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <PizzariaSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center justify-between border-b px-4">
              <div className="flex items-center">
                <SidebarTrigger />
                <span className="ml-3 text-sm text-muted-foreground font-heading hidden sm:inline">Área da Pizzaria</span>
              </div>
              <ThemeToggle />
            </header>
            <main className="flex-1 p-3 sm:p-6 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </MinhaPizzariaProvider>
  );
}

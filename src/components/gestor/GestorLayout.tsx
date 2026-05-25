import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { GestorSidebar } from "./GestorSidebar";
import { Outlet, Navigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";

export function GestorLayout() {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!usuario || usuario.perfil !== "gestor") {
    return <Navigate to="/" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <GestorSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-sm px-4 sticky top-0 z-10">
            <div className="flex items-center gap-1">
              <SidebarTrigger />
              <span className="ml-2 text-sm text-muted-foreground font-heading hidden sm:inline">Painel do Gestor</span>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 p-4 sm:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

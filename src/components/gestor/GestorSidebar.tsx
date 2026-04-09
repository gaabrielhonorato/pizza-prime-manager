import { LayoutDashboard, Store, Trophy, DollarSign, Pizza, Users, Settings, MessageCircle, LogOut, Bike, Megaphone, BarChart3, ChevronRight, ShoppingBag } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const items = [
  { title: "Dashboard", url: "/gestor", icon: LayoutDashboard },
  { title: "Campanhas", url: "/gestor/campanhas", icon: Megaphone },
  { title: "Pizzarias", url: "/gestor/pizzarias", icon: Store },
  { title: "Consumidores", url: "/gestor/consumidores", icon: Users },
  { title: "Entregadores", url: "/gestor/entregadores", icon: Bike },
];

const itemsAfter = [
  { title: "WhatsApp", url: "/gestor/whatsapp", icon: MessageCircle },
  { title: "Sorteio", url: "/gestor/sorteio", icon: Trophy },
  { title: "Financeiro", url: "/gestor/financeiro", icon: DollarSign },
  { title: "Configurações", url: "/gestor/configuracoes", icon: Settings },
];

const desempenhoSubs = [
  { title: "Vendas", url: "/gestor/desempenho/vendas", icon: ShoppingBag },
  { title: "Clientes", url: "/gestor/desempenho/clientes", icon: Users },
];

const DESEMPENHO_STORAGE_KEY = "gestor-sidebar-desempenho-open";

export function GestorSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const isDesempenhoActive = location.pathname.startsWith("/gestor/desempenho");
  const [desempenhoOpen, setDesempenhoOpen] = useState(() => {
    if (typeof window === "undefined") {
      return isDesempenhoActive;
    }

    const savedState = window.localStorage.getItem(DESEMPENHO_STORAGE_KEY);

    if (savedState === null) {
      return isDesempenhoActive;
    }

    return savedState === "true";
  });

  useEffect(() => {
    if (isDesempenhoActive) {
      setDesempenhoOpen(true);
    }
  }, [isDesempenhoActive]);

  useEffect(() => {
    window.localStorage.setItem(DESEMPENHO_STORAGE_KEY, String(desempenhoOpen));
  }, [desempenhoOpen]);

  const renderItem = (item: { title: string; url: string; icon: React.ComponentType<any> }) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          end={item.url === "/gestor"}
          className="hover:bg-sidebar-accent"
          activeClassName="bg-sidebar-accent text-primary font-medium"
        >
          <item.icon className="mr-2 h-4 w-4" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-2 px-4 py-5">
          <Pizza className="h-7 w-7 text-primary shrink-0" />
          {!collapsed && (
            <span className="font-heading text-lg font-bold text-foreground tracking-tight">
              Pizza Premiada
            </span>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(renderItem)}

              {/* Desempenho expandable */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setDesempenhoOpen((prev) => !prev)}
                  className={cn(
                    "hover:bg-sidebar-accent cursor-pointer",
                    isDesempenhoActive && "bg-sidebar-accent text-primary font-medium"
                  )}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  {!collapsed && (
                    <>
                      <span className="flex-1">Desempenho</span>
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 transition-transform duration-200",
                           desempenhoOpen && "rotate-180"
                        )}
                      />
                    </>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Sub-items */}
              {desempenhoOpen && !collapsed && desempenhoSubs.map((sub) => (
                <SidebarMenuItem key={sub.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={sub.url}
                      className="hover:bg-sidebar-accent pl-9"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <sub.icon className="mr-2 h-3.5 w-3.5" />
                      <span className="text-sm">{sub.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {itemsAfter.map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={async () => { await signOut(); navigate("/"); }}>
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Sair"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

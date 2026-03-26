import { LayoutDashboard, Store, Trophy, DollarSign, Pizza, Users, Settings, MessageCircle, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
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

const items = [
  { title: "Dashboard", url: "/gestor", icon: LayoutDashboard },
  { title: "Pizzarias", url: "/gestor/pizzarias", icon: Store },
  { title: "Consumidores", url: "/gestor/consumidores", icon: Users },
  { title: "WhatsApp", url: "/gestor/whatsapp", icon: MessageCircle },
  { title: "Sorteio", url: "/gestor/sorteio", icon: Trophy },
  { title: "Financeiro", url: "/gestor/financeiro", icon: DollarSign },
  { title: "Configurações", url: "/gestor/configuracoes", icon: Settings },
];

export function GestorSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { signOut } = useAuth();

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
              {items.map((item) => (
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
              ))}
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

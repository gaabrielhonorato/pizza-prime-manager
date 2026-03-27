import { LayoutDashboard, DollarSign, ClipboardList, Store, LogOut, Pizza } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMinhaPizzaria } from "@/contexts/MinhaPizzariaContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Dashboard", url: "/pizzaria/dashboard", icon: LayoutDashboard },
  { title: "Financeiro", url: "/pizzaria/financeiro", icon: DollarSign },
  { title: "Pedidos", url: "/pizzaria/pedidos", icon: ClipboardList },
  { title: "Minha Pizzaria", url: "/pizzaria/minha-pizzaria", icon: Store },
];

export function PizzariaSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { signOut, usuario } = useAuth();
  const { pizzaria } = useMinhaPizzaria();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-2 px-4 py-5">
          <Pizza className="h-7 w-7 text-primary shrink-0" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-heading text-sm font-bold text-foreground tracking-tight leading-none">Pizza Premiada</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">{pizzaria?.nome ?? "Carregando..."}</span>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/pizzaria/dashboard"} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-primary font-medium">
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

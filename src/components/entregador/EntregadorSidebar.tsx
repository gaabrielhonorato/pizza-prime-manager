import { Home, Package, MapPin, User, LogOut, Pizza } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const items = [
  { title: "Início", url: "/entregador/app", icon: Home },
  { title: "Pedidos", url: "/entregador/app/pedidos", icon: Package },
  { title: "Mapa", url: "/entregador/app/mapa", icon: MapPin },
  { title: "Perfil", url: "/entregador/app/perfil", icon: User },
];

export function EntregadorSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const [disponivel, setDisponivel] = useState(true);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-2 px-4 py-5">
          <Pizza className="h-7 w-7 text-primary shrink-0" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-heading text-sm font-bold text-foreground tracking-tight leading-none">Pizza Premiada</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">João Entregador</span>
            </div>
          )}
        </div>

        {/* Toggle de disponibilidade */}
        <div className="px-4 pb-3">
          {collapsed ? (
            <div className="flex justify-center">
              <div className={`h-3 w-3 rounded-full ${disponivel ? "bg-green-500" : "bg-muted-foreground"}`} />
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${disponivel ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
                <span className="text-xs font-medium">
                  {disponivel ? "Disponível" : "Indisponível"}
                </span>
              </div>
              <Switch checked={disponivel} onCheckedChange={setDisponivel} className="scale-75" />
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/entregador/app"} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-primary font-medium">
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
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={() => navigate("/")}>
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Sair"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

import { Home, Ticket, Trophy, ShoppingBag, Gift, User, LogOut, Pizza } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const items = [
  { title: "Início", url: "/consumidor/dashboard", icon: Home },
  { title: "Meus Cupons", url: "/consumidor/cupons", icon: Ticket },
  { title: "Ranking", url: "/consumidor/ranking", icon: Trophy },
  { title: "Meus Pedidos", url: "/consumidor/pedidos", icon: ShoppingBag },
  { title: "Prêmios e Regulamento", url: "/consumidor/premios", icon: Gift },
  { title: "Meu Perfil", url: "/consumidor/perfil", icon: User },
];

export function ConsumidorSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-2 px-4 py-5">
          <Pizza className="h-7 w-7 text-primary shrink-0" />
          {!collapsed && (
            <span className="font-heading text-sm font-bold text-foreground tracking-tight leading-none">Pizza Premiada</span>
          )}
        </div>

        {!collapsed && (
          <div className="flex items-center gap-3 px-4 pb-4">
            <Avatar className="h-9 w-9 border border-primary/30">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">MS</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground leading-none">Maria Silva</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">12º no ranking</span>
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className="hover:bg-muted/50" activeClassName="bg-muted text-primary font-medium">
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

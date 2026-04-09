import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DesempenhoLayout() {
  const [pizzarias, setPizzarias] = useState<{ id: string; nome: string }[]>([]);
  const [campanhas, setCampanhas] = useState<{ id: string; nome: string }[]>([]);
  const [selectedPizzaria, setSelectedPizzaria] = useState("todas");
  const [selectedCampanha, setSelectedCampanha] = useState("todas");

  useEffect(() => {
    supabase.from("pizzarias").select("id, nome").order("nome").then(({ data }) => {
      if (data) setPizzarias(data);
    });
    supabase.from("campanhas").select("id, nome").order("nome").then(({ data }) => {
      if (data) setCampanhas(data);
    });
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors",
      isActive
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );

  return (
    <div className="flex h-full">
      {/* Sub-sidebar */}
      <aside className="w-48 shrink-0 border-r bg-card flex flex-col py-4 px-2 gap-1">
        <h3 className="px-4 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Desempenho
        </h3>
        <NavLink to="/gestor/desempenho/vendas" className={linkClass}>
          <BarChart3 className="h-4 w-4" />
          Vendas
        </NavLink>
        <NavLink to="/gestor/desempenho/clientes" className={linkClass}>
          <Users className="h-4 w-4" />
          Clientes
        </NavLink>
      </aside>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {/* Global filters */}
        <div className="flex items-center gap-4 px-6 py-3 border-b bg-card">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Pizzaria:</span>
            <Select value={selectedPizzaria} onValueChange={setSelectedPizzaria}>
              <SelectTrigger className="w-[200px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as pizzarias</SelectItem>
                {pizzarias.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Campanha:</span>
            <Select value={selectedCampanha} onValueChange={setSelectedCampanha}>
              <SelectTrigger className="w-[200px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as campanhas</SelectItem>
                {campanhas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-0">
          <Outlet context={{ selectedPizzaria, selectedCampanha }} />
        </div>
      </div>
    </div>
  );
}

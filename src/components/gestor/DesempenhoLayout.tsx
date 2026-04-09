import { Outlet } from "react-router-dom";
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

  return (
    <div className="space-y-6">
      {/* Global filters */}
      <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-card">
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

      <Outlet context={{ selectedPizzaria, selectedCampanha }} />
    </div>
  );
}

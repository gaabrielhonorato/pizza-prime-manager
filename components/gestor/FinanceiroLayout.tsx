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

export default function FinanceiroLayout() {
  const [campanhas, setCampanhas] = useState<{ id: string; nome: string }[]>([]);
  const [selectedCampanha, setSelectedCampanha] = useState("todas");
  const [periodo, setPeriodo] = useState("ciclo");

  useEffect(() => {
    supabase.from("campanhas").select("id, nome").order("nome").then(({ data }) => {
      if (data) setCampanhas(data);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Período:</span>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ciclo">Ciclo completo</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
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

      <Outlet context={{ selectedCampanha, periodo }} />
    </div>
  );
}
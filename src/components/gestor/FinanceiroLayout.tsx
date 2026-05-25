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
  const [filterSlot, setFilterSlot] = useState<HTMLDivElement | null>(null);
  const [exportSlot, setExportSlot] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.from("campanhas").select("id, nome").order("nome").then(({ data }) => {
      if (data) setCampanhas(data);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card flex-wrap">
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

        <div className="w-px h-5 bg-border" />

        <div ref={setFilterSlot} className="contents" />
        <div ref={setExportSlot} className="ml-auto flex items-center gap-2" />
      </div>

      <Outlet context={{ selectedCampanha, filterSlot, exportSlot }} />
    </div>
  );
}
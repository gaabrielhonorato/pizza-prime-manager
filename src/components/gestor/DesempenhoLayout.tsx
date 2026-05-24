import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Search } from "lucide-react";

export default function DesempenhoLayout() {
  const [pizzarias, setPizzarias] = useState<{ id: string; nome: string }[]>([]);
  const [campanhas, setCampanhas] = useState<{ id: string; nome: string }[]>([]);
  const [consumidores, setConsumidores] = useState<{ id: string; nome: string }[]>([]);
  const [selectedPizzaria, setSelectedPizzaria] = useState("todas");
  const [selectedCampanha, setSelectedCampanha] = useState("todas");
  const [selectedConsumidor, setSelectedConsumidor] = useState("todos");
  const [consumerSearch, setConsumerSearch] = useState("");
  const [consumerOpen, setConsumerOpen] = useState(false);
  const [exportNode, setExportNode] = useState<ReactNode>(null);

  useEffect(() => {
    supabase.from("pizzarias").select("id, nome").order("nome").then(({ data }) => {
      if (data) setPizzarias(data);
    });
    supabase.from("campanhas").select("id, nome").order("nome").then(({ data }) => {
      if (data) setCampanhas(data);
    });
    supabase.from("usuarios").select("id, nome").eq("perfil", "consumidor").order("nome").then(({ data }) => {
      if (data) setConsumidores(data as { id: string; nome: string }[]);
    });
  }, []);

  const selectedNome = selectedConsumidor === "todos"
    ? null
    : consumidores.find(c => c.id === selectedConsumidor)?.nome;

  const filteredConsumidores = consumidores.filter(c =>
    !consumerSearch || c.nome.toLowerCase().includes(consumerSearch.toLowerCase())
  ).slice(0, 40);

  return (
    <div className="space-y-6">
      {/* Barra global de filtros */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card flex-wrap">

        {/* Campanha */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Campanha:</span>
          <Select value={selectedCampanha} onValueChange={setSelectedCampanha}>
            <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as campanhas</SelectItem>
              {campanhas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Pizzaria */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Pizzaria:</span>
          <Select value={selectedPizzaria} onValueChange={setSelectedPizzaria}>
            <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as pizzarias</SelectItem>
              {pizzarias.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Consumidor */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Consumidor:</span>
          <Popover open={consumerOpen} onOpenChange={setConsumerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={selectedConsumidor !== "todos" ? "default" : "outline"}
                size="sm"
                className="h-8 text-sm gap-1.5 w-[180px] justify-between"
              >
                <span className="truncate">{selectedNome ?? "Todos"}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="flex items-center gap-1.5 border-b pb-2 mb-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Buscar consumidor..."
                  value={consumerSearch}
                  onChange={e => setConsumerSearch(e.target.value)}
                  className="h-7 text-xs border-0 p-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="max-h-52 overflow-y-auto space-y-0.5">
                <button
                  onClick={() => { setSelectedConsumidor("todos"); setConsumerOpen(false); setConsumerSearch(""); }}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors ${selectedConsumidor === "todos" ? "bg-primary/10 text-primary font-medium" : ""}`}
                >
                  Todos os consumidores
                </button>
                {filteredConsumidores.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedConsumidor(c.id); setConsumerOpen(false); setConsumerSearch(""); }}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors ${selectedConsumidor === c.id ? "bg-primary/10 text-primary font-medium" : ""}`}
                  >
                    {c.nome}
                  </button>
                ))}
                {filteredConsumidores.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum resultado</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Slot de exportação — preenchido pela sub-página */}
        {exportNode && <div className="ml-auto">{exportNode}</div>}
      </div>

      <Outlet context={{ selectedPizzaria, selectedCampanha, selectedConsumidor, setExportNode }} />
    </div>
  );
}

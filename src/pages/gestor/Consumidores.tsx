import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Users, UserCheck, Ticket, Crown, Search,
  Eye, Pencil, X, Plus, MessageCircle,
  MapPin, Clock, BarChart2, Tag, Trophy,
} from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, subMonths, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid } from "recharts";

const medalColors: Record<number, string> = {
  0: "bg-yellow-500 text-black",
  1: "bg-gray-400 text-black",
  2: "bg-amber-700 text-white",
};

const CHART_COLORS = [
  "hsl(25 95% 53%)",
  "hsl(38 92% 52%)",
  "hsl(14 88% 50%)",
  "hsl(50 90% 50%)",
  "hsl(5 82% 46%)",
  "hsl(55 88% 48%)",
  "hsl(350 78% 48%)",
];
import { usePizzarias } from "@/contexts/PizzariasContext";
import { useConsumidoresData, type ConsumidorData } from "@/hooks/useConsumidoresData";
import { BRASIL_ESTADOS, fetchCidadesDoEstado } from "@/lib/brasil";
import ExportButton from "@/components/gestor/ExportButton";
import ReportExportDropdown from "@/components/gestor/ReportExportDropdown";
import { generateConsumerReport } from "@/lib/consumerReport";

type Consumidor = ConsumidorData;

type SortKey = "cupons" | "pedidos" | "gasto" | "recente";
type QuickPeriod = "hoje" | "7dias" | "30dias" | "este_mes" | "mes_anterior" | null;

function getQuickRange(p: NonNullable<QuickPeriod>): [Date, Date] {
  const today = startOfDay(new Date());
  switch (p) {
    case "hoje": return [today, endOfDay(today)];
    case "7dias": return [subDays(today, 6), endOfDay(today)];
    case "30dias": return [subDays(today, 29), endOfDay(today)];
    case "este_mes": return [startOfMonth(today), endOfDay(today)];
    case "mes_anterior": {
      const prev = subMonths(today, 1);
      return [startOfMonth(prev), endOfDay(endOfMonth(prev))];
    }
  }
}

const QUICK_LABELS: Record<NonNullable<QuickPeriod>, string> = {
  hoje: "Hoje",
  "7dias": "7 dias",
  "30dias": "30 dias",
  este_mes: "Este mês",
  mes_anterior: "Mês anterior",
};

export default function Consumidores() {
  const navigate = useNavigate();
  const { pizzarias } = usePizzarias();
  const { data, loading: consumidoresLoading } = useConsumidoresData();

  // Filters — table
  const [searchText, setSearchText] = useState("");
  const [filterPizzaria, setFilterPizzaria] = useState("all");
  const [filterCidade, setFilterCidade] = useState("all");
  const [filterBairro, setFilterBairro] = useState("all");
  const [filterCuponsMin, setFilterCuponsMin] = useState("");
  const [filterCuponsMax, setFilterCuponsMax] = useState("");
  const [filterPedidosMin, setFilterPedidosMin] = useState("");
  const [filterPedidosMax, setFilterPedidosMax] = useState("");
  const [filterTicketMin, setFilterTicketMin] = useState("");
  const [filterTicketMax, setFilterTicketMax] = useState("");
  const [filterStatus, setFilterStatus] = useState("Ativo");

  // Table
  const [sortKey, setSortKey] = useState<SortKey>("cupons");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  // Detail drawer
  const [selected, setSelected] = useState<Consumidor | null>(null);

  // Add consumer modal
  const [addOpen, setAddOpen] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newCpf, setNewCpf] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newTelefone, setNewTelefone] = useState("");
  const [newCidade, setNewCidade] = useState("");
  const [newBairro, setNewBairro] = useState("");
  const [newPizzaria, setNewPizzaria] = useState("");
  const [newSenha, setNewSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [sendBoasVindas, setSendBoasVindas] = useState(true);
  const [newGenero, setNewGenero] = useState("");
  const [newDataNascimento, setNewDataNascimento] = useState("");
  const [newAceitaWhatsapp, setNewAceitaWhatsapp] = useState(true);
  const [newEstado, setNewEstado] = useState("");
  const [addCidades, setAddCidades] = useState<string[]>([]);
  const [addCidadesLoading, setAddCidadesLoading] = useState(false);

  // Chart period
  const [chartQuick, setChartQuick] = useState<QuickPeriod>("este_mes");
  const [chartFrom, setChartFrom] = useState<Date>(startOfMonth(new Date()));
  const [chartTo, setChartTo] = useState<Date>(endOfDay(new Date()));
  const [chartCustomFromStr, setChartCustomFromStr] = useState("");
  const [chartCustomToStr, setChartCustomToStr] = useState("");

  const selectChartQuick = (p: NonNullable<QuickPeriod>) => {
    setChartQuick(p);
    const [f, t] = getQuickRange(p);
    setChartFrom(f); setChartTo(t);
    setChartCustomFromStr(format(f, "yyyy-MM-dd"));
    setChartCustomToStr(format(t, "yyyy-MM-dd"));
  };
  const applyChartCustom = () => {
    if (chartCustomFromStr && chartCustomToStr) {
      setChartQuick(null);
      setChartFrom(startOfDay(new Date(chartCustomFromStr + "T00:00:00")));
      setChartTo(endOfDay(new Date(chartCustomToStr + "T00:00:00")));
    }
  };

  // Derived: cities / bairros — filter(Boolean) prevents empty-string SelectItem crash
  const cidades = useMemo(() => [...new Set(data.map((c) => c.cidade).filter(Boolean))].sort(), [data]);
  const bairros = useMemo(() => {
    const base = filterCidade === "all" ? data : data.filter((c) => c.cidade === filterCidade);
    return [...new Set(base.map((c) => c.bairro).filter(Boolean))].sort();
  }, [data, filterCidade]);

  // Active filter flags
  const isLocalizacaoActive = filterPizzaria !== "all" || filterCidade !== "all" || filterBairro !== "all";
  const localizacaoCount = (filterPizzaria !== "all" ? 1 : 0) + (filterCidade !== "all" ? 1 : 0) + (filterBairro !== "all" ? 1 : 0);
  const isMetricasActive = !!(filterCuponsMin || filterCuponsMax || filterPedidosMin || filterPedidosMax || filterTicketMin || filterTicketMax);
  const metricasCount = [filterCuponsMin, filterCuponsMax, filterPedidosMin, filterPedidosMax, filterTicketMin, filterTicketMax].filter(Boolean).length;
  const hasActiveFilters = isLocalizacaoActive || isMetricasActive || filterStatus !== "Ativo";

  // Apply filters
  const filtered = useMemo(() => {
    let list = [...data];
    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter((c) =>
        c.nome.toLowerCase().includes(q) ||
        c.cpf.includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.telefone.includes(q)
      );
    }
    if (filterPizzaria !== "all") list = list.filter((c) => c.pizzariaVinculadaId === filterPizzaria);
    if (filterCidade !== "all") list = list.filter((c) => c.cidade === filterCidade);
    if (filterBairro !== "all") list = list.filter((c) => c.bairro === filterBairro);
    if (filterCuponsMin) list = list.filter((c) => c.cuponsAcumulados >= Number(filterCuponsMin));
    if (filterCuponsMax) list = list.filter((c) => c.cuponsAcumulados <= Number(filterCuponsMax));
    if (filterPedidosMin) list = list.filter((c) => c.totalPedidos >= Number(filterPedidosMin));
    if (filterPedidosMax) list = list.filter((c) => c.totalPedidos <= Number(filterPedidosMax));
    if (filterTicketMin) list = list.filter((c) => c.ticketMedio >= Number(filterTicketMin));
    if (filterTicketMax) list = list.filter((c) => c.ticketMedio <= Number(filterTicketMax));
    if (filterStatus !== "Todos") list = list.filter((c) => c.status === filterStatus);
    return list;
  }, [data, searchText, filterPizzaria, filterCidade, filterBairro, filterCuponsMin, filterCuponsMax, filterPedidosMin, filterPedidosMax, filterTicketMin, filterTicketMax, filterStatus]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortKey) {
      case "cupons": return arr.sort((a, b) => b.cuponsAcumulados - a.cuponsAcumulados);
      case "pedidos": return arr.sort((a, b) => b.totalPedidos - a.totalPedidos);
      case "gasto": return arr.sort((a, b) => b.totalGasto - a.totalGasto);
      case "recente": return arr.sort((a, b) => b.dataCadastro.getTime() - a.dataCadastro.getTime());
    }
  }, [filtered, sortKey]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paged = sorted.slice((page - 1) * perPage, page * perPage);

  const clearFilters = () => {
    setSearchText(""); setFilterPizzaria("all"); setFilterCidade("all"); setFilterBairro("all");
    setFilterCuponsMin(""); setFilterCuponsMax("");
    setFilterPedidosMin(""); setFilterPedidosMax("");
    setFilterTicketMin(""); setFilterTicketMax("");
    setFilterStatus("Ativo"); setPage(1);
  };

  // KPI cards
  const totalConsumidores = data.length;
  const ativos = data.filter((c) => c.status === "Ativo").length;
  const mediaCupons = totalConsumidores > 0 ? (data.reduce((s, c) => s + c.cuponsAcumulados, 0) / totalConsumidores).toFixed(1) : "0";
  const topConsumidor = useMemo(() => {
    if (data.length === 0) return null;
    return [...data].sort((a, b) => b.cuponsAcumulados - a.cuponsAcumulados)[0];
  }, [data]);

  // Ranking position helper
  const rankingSorteio = useMemo(() => {
    return [...data].sort((a, b) => b.cuponsAcumulados - a.cuponsAcumulados);
  }, [data]);

  const getRankingPosition = (id: string) => {
    const idx = rankingSorteio.findIndex((c) => c.id === id);
    return idx >= 0 ? idx + 1 : null;
  };

  // Chart data — novos consumidores por dia
  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfDay(chartFrom), end: endOfDay(chartTo) });
    return days.map((day) => ({
      label: format(day, "dd/MM"),
      novos: data.filter((c) => isSameDay(c.dataCadastro, day)).length,
    }));
  }, [data, chartFrom, chartTo]);

  // Top 10 consumidores por cupons
  const topConsumidoresData = useMemo(() =>
    [...data].sort((a, b) => b.cuponsAcumulados - a.cuponsAcumulados)
      .slice(0, 10)
      .map((c) => ({ nome: c.nome.split(" ")[0], cupons: c.cuponsAcumulados, gasto: c.totalGasto })),
    [data]
  );

  // Frequência de compras — segmentação por intervalo médio
  const frequenciaData = useMemo(() => {
    const segments = [
      { name: "Sem compras", color: CHART_COLORS[4], filter: (c: ConsumidorData) => c.totalPedidos === 0 },
      { name: "Pedido único", color: CHART_COLORS[2], filter: (c: ConsumidorData) => c.totalPedidos === 1 },
      { name: "Semanal", color: CHART_COLORS[3], filter: (c: ConsumidorData) => c.intervaloMedio > 0 && c.intervaloMedio <= 10 },
      { name: "Quinzenal", color: CHART_COLORS[1], filter: (c: ConsumidorData) => c.intervaloMedio > 10 && c.intervaloMedio <= 20 },
      { name: "Mensal", color: CHART_COLORS[0], filter: (c: ConsumidorData) => c.intervaloMedio > 20 && c.intervaloMedio <= 40 },
      { name: "Bimestral", color: CHART_COLORS[5], filter: (c: ConsumidorData) => c.intervaloMedio > 40 && c.intervaloMedio <= 90 },
      { name: "Esporádico", color: CHART_COLORS[6], filter: (c: ConsumidorData) => c.intervaloMedio > 90 },
    ];
    return segments
      .map(s => ({ name: s.name, color: s.color, count: data.filter(s.filter).length }))
      .filter(s => s.count > 0);
  }, [data]);

  // Distribuição por cidade (top 7)
  const cidadeDistData = useMemo(() => {
    const map = new Map<string, number>();
    data.filter((c) => c.cidade).forEach((c) => map.set(c.cidade, (map.get(c.cidade) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([cidade, count]) => ({ cidade, count }));
  }, [data]);

  const resetAddForm = () => {
    setNewNome(""); setNewCpf(""); setNewEmail(""); setNewTelefone("");
    setNewCidade(""); setNewBairro(""); setNewPizzaria(""); setNewSenha("");
    setShowSenha(false); setSendBoasVindas(true);
    setNewGenero(""); setNewDataNascimento(""); setNewAceitaWhatsapp(true);
    setNewEstado(""); setAddCidades([]);
  };

  const chartPeriodLabel = chartQuick ? QUICK_LABELS[chartQuick] : `${format(chartFrom, "dd/MM/yyyy")} – ${format(chartTo, "dd/MM/yyyy")}`;

  // Fetch cities from IBGE when estado changes in add form
  const handleNewEstado = async (uf: string) => {
    setNewEstado(uf);
    setNewCidade("");
    setAddCidades([]);
    if (!uf) return;
    setAddCidadesLoading(true);
    const cids = await fetchCidadesDoEstado(uf);
    setAddCidades(cids);
    setAddCidadesLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-bold">Consumidores</h1>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, CPF, e-mail..." className="pl-8 h-9 text-sm" value={searchText} onChange={(e) => { setSearchText(e.target.value); setPage(1); }} />
          </div>
          <ExportButton
            data={sorted.map(c => ({
              nome: c.nome, telefone: c.telefone, email: c.email, cpf: c.cpf,
              cidade: c.cidade, bairro: c.bairro, pizzaria: c.pizzariaVinculadaNome,
              totalPedidos: c.totalPedidos,
              totalGasto: `R$ ${c.totalGasto}`, cupons: c.cuponsAcumulados,
              saldoAcumulado: `R$ ${c.saldoAcumulado.toFixed(2)}`,
              faltaProximoCupom: `R$ ${c.faltaProximoCupom.toFixed(2)}`,
              diasSemPedido: c.diasDesdeUltimoPedido !== null ? `${c.diasDesdeUltimoPedido}d` : "-",
              frequencia: c.intervaloMedio > 0 ? `${c.intervaloMedio}d` : "-",
              dataCadastro: format(c.dataCadastro, "dd/MM/yyyy"), status: c.status,
            }))}
            columns={[
              { key: "nome", label: "Nome" }, { key: "telefone", label: "Telefone" },
              { key: "email", label: "E-mail" }, { key: "cpf", label: "CPF" },
              { key: "cidade", label: "Cidade" }, { key: "bairro", label: "Bairro" },
              { key: "pizzaria", label: "Pizzaria" },
              { key: "totalPedidos", label: "Total Pedidos" }, { key: "totalGasto", label: "Total Gasto" },
              { key: "cupons", label: "Cupons" },
              { key: "saldoAcumulado", label: "Saldo Acumulado" },
              { key: "faltaProximoCupom", label: "Falta Próximo Cupom" },
              { key: "diasSemPedido", label: "Dias s/ Pedido" },
              { key: "frequencia", label: "Frequência" },
              { key: "dataCadastro", label: "Data Cadastro" },
              { key: "status", label: "Status" },
            ]}
            fileName="consumidores"
            metaAds={{
              enabled: true,
              mapping: { phone: "telefone", email: "email", fn: "nome", ct: "cidade" },
              getData: () => sorted.map(c => ({ telefone: c.telefone, email: c.email, nome: c.nome, cidade: c.cidade })),
            }}
          />
          <ReportExportDropdown
            label="Relatório"
            onExportPDF={async () => {
              const { data: camp } = await (await import("@/integrations/supabase/client")).supabase.from("campanhas").select("id, nome").eq("is_principal", true).limit(1).single();
              if (camp) await generateConsumerReport({ campanhaId: camp.id, campanhaNome: camp.nome, format: "pdf" });
            }}
            onExportDocx={async () => {
              const { data: camp } = await (await import("@/integrations/supabase/client")).supabase.from("campanhas").select("id, nome").eq("is_principal", true).limit(1).single();
              if (camp) await generateConsumerReport({ campanhaId: camp.id, campanhaNome: camp.nome, format: "docx" });
            }}
          />
          <Button onClick={() => { resetAddForm(); setAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Consumidor
          </Button>
        </div>
      </div>

      {/* BLOCO 1 — KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cadastrados</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-heading font-bold">{totalConsumidores}</div></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos no Ciclo</CardTitle>
            <UserCheck className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-heading font-bold">{ativos}</div></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Média de Cupons</CardTitle>
            <Ticket className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-heading font-bold">{mediaCupons}</div></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mais Cupons</CardTitle>
            <Crown className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-heading font-bold">{topConsumidor?.nome ?? "-"}</div>
            <p className="text-xs text-muted-foreground">{topConsumidor ? `${topConsumidor.cuponsAcumulados} cupons` : ""}</p>
          </CardContent>
        </Card>
      </div>

      {/* BLOCO 3 — Table */}
      <Card className="border-border bg-card">
        <CardHeader className="py-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Left: title + count */}
            <CardTitle className="text-base font-heading shrink-0">Lista de Consumidores</CardTitle>
            <span className="text-xs text-muted-foreground shrink-0">
              {sorted.length === data.length ? data.length : `${sorted.length} / ${data.length}`}
            </span>
            {/* Right: filters + controls */}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/* Localização */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={isLocalizacaoActive ? "default" : "outline"} size="sm" className="h-8 text-xs gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {isLocalizacaoActive ? `${localizacaoCount} local` : "Localização"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3 space-y-3" align="end">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Pizzaria</label>
                    <Select value={filterPizzaria} onValueChange={(v) => { setFilterPizzaria(v); setPage(1); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {pizzarias.filter((p) => p.status === "Ativa").map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Cidade</label>
                    <Select value={filterCidade} onValueChange={(v) => { setFilterCidade(v); setFilterBairro("all"); setPage(1); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Bairro</label>
                    <Select value={filterBairro} onValueChange={(v) => { setFilterBairro(v); setPage(1); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {bairros.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Métricas */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={isMetricasActive ? "default" : "outline"} size="sm" className="h-8 text-xs gap-1.5">
                    <BarChart2 className="h-3.5 w-3.5" />
                    {isMetricasActive ? `${metricasCount} métrica(s)` : "Métricas"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-3 space-y-3" align="end">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Cupons (min – máx)</label>
                    <div className="flex gap-1">
                      <Input type="number" placeholder="Min" className="h-8 text-xs" value={filterCuponsMin} onChange={(e) => { setFilterCuponsMin(e.target.value); setPage(1); }} />
                      <Input type="number" placeholder="Máx" className="h-8 text-xs" value={filterCuponsMax} onChange={(e) => { setFilterCuponsMax(e.target.value); setPage(1); }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Pedidos (min – máx)</label>
                    <div className="flex gap-1">
                      <Input type="number" placeholder="Min" className="h-8 text-xs" value={filterPedidosMin} onChange={(e) => { setFilterPedidosMin(e.target.value); setPage(1); }} />
                      <Input type="number" placeholder="Máx" className="h-8 text-xs" value={filterPedidosMax} onChange={(e) => { setFilterPedidosMax(e.target.value); setPage(1); }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Ticket Médio R$ (min – máx)</label>
                    <div className="flex gap-1">
                      <Input type="number" placeholder="Min" className="h-8 text-xs" value={filterTicketMin} onChange={(e) => { setFilterTicketMin(e.target.value); setPage(1); }} />
                      <Input type="number" placeholder="Máx" className="h-8 text-xs" value={filterTicketMax} onChange={(e) => { setFilterTicketMax(e.target.value); setPage(1); }} />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Status */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={filterStatus !== "Ativo" ? "default" : "outline"} size="sm" className="h-8 text-xs gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    {filterStatus === "Ativo" ? "Ativos" : filterStatus === "Inativo" ? "Inativos" : "Todos"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-2 space-y-0.5" align="end">
                  {(["Ativo", "Inativo", "Todos"] as const).map((s) => (
                    <Button key={s} variant={filterStatus === s ? "default" : "ghost"} size="sm" className="w-full justify-start text-xs h-8" onClick={() => { setFilterStatus(s); setPage(1); }}>
                      {s === "Ativo" ? "Ativos" : s === "Inativo" ? "Inativos" : "Todos"}
                    </Button>
                  ))}
                </PopoverContent>
              </Popover>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground gap-1" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5" /> Limpar
                </Button>
              )}

              <div className="w-px h-5 bg-border mx-1" />

              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cupons">Mais cupons</SelectItem>
                  <SelectItem value="pedidos">Mais pedidos</SelectItem>
                  <SelectItem value="gasto">Maior gasto</SelectItem>
                  <SelectItem value="recente">Cadastro recente</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-8 w-[85px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 30, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} / pág</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center w-[180px] min-w-[180px] max-w-[180px]">Nome</TableHead>
                  <TableHead className="text-center">Pedidos</TableHead>
                  <TableHead className="text-center">Ticket Médio</TableHead>
                  <TableHead className="text-center">Total Gasto</TableHead>
                  <TableHead className="text-center">Cupons</TableHead>
                  <TableHead className="text-center">Saldo</TableHead>
                  <TableHead className="text-center">Falta</TableHead>
                  <TableHead className="text-center">1º Pedido</TableHead>
                  <TableHead className="text-center">Último Pedido</TableHead>
                  <TableHead className="text-center">Dias s/ Pedido</TableHead>
                  <TableHead className="text-center">Frequência</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-center w-[180px] min-w-[180px] max-w-[180px]"><span className="block truncate">{c.nome}</span></TableCell>
                    <TableCell className="text-center">{c.totalPedidos}</TableCell>
                    <TableCell className="text-center">R$ {c.ticketMedio}</TableCell>
                    <TableCell className="text-center">R$ {c.totalGasto.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-center font-bold text-primary">{c.cuponsAcumulados}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">R$ {c.saldoAcumulado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center text-xs text-amber-500 font-medium">R$ {c.faltaProximoCupom.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center text-xs">{c.primeiroPedido ? format(c.primeiroPedido, "dd/MM/yy") : "-"}</TableCell>
                    <TableCell className="text-center text-xs">{c.ultimoPedido ? format(c.ultimoPedido, "dd/MM/yy") : "-"}</TableCell>
                    <TableCell className="text-center text-xs">
                      {c.diasDesdeUltimoPedido !== null
                        ? <span className={c.diasDesdeUltimoPedido > 60 ? "text-destructive font-medium" : c.diasDesdeUltimoPedido > 30 ? "text-amber-500 font-medium" : "text-green-500 font-medium"}>
                            {c.diasDesdeUltimoPedido}d
                          </span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {c.intervaloMedio === 0
                        ? <span className="text-muted-foreground">—</span>
                        : (() => {
                            const d = c.intervaloMedio;
                            const [label, cls] = d <= 10
                              ? ["Semanal", "text-green-500"]
                              : d <= 20 ? ["Quinzenal", "text-green-500"]
                              : d <= 40 ? ["Mensal", "text-amber-500"]
                              : d <= 90 ? ["Bimestral", "text-amber-500"]
                              : ["Esporádico", "text-destructive"];
                            return <span className={`font-medium ${cls}`}>{label} ({d}d)</span>;
                          })()
                      }
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(c)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próxima</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 4 — Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center justify-between gap-2">
                  <SheetTitle className="font-heading">{selected.nome}</SheetTitle>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => { setSelected(null); navigate(`/gestor/consumidores/${selected.id}`); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                </div>
              </SheetHeader>
              <div className="mt-4 space-y-6">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">E-mail:</span> {selected.email}</div>
                  <div><span className="text-muted-foreground">Telefone:</span> {selected.telefone}</div>
                  <div><span className="text-muted-foreground">CPF:</span> {selected.cpf || "-"}</div>
                  <div><span className="text-muted-foreground">Cidade:</span> {selected.cidade || "-"}</div>
                  <div><span className="text-muted-foreground">Bairro:</span> {selected.bairro || "-"}</div>
                  <div><span className="text-muted-foreground">Pizzaria:</span> {selected.pizzariaVinculadaNome || "-"}</div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant={selected.status === "Ativo" ? "default" : "secondary"} className="text-xs ml-1">{selected.status}</Badge></div>
                  <div><span className="text-muted-foreground">WhatsApp:</span> {selected.aceitaWhatsapp ? "Sim" : "Não"}</div>
                </div>
                {selected.tags.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.tags.map((tag) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Total Pedidos</p>
                    <p className="text-lg font-bold">{selected.totalPedidos}</p>
                  </Card>
                  <Card className="border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Total Gasto</p>
                    <p className="text-lg font-bold">R$ {selected.totalGasto.toLocaleString("pt-BR")}</p>
                  </Card>
                  <Card className="border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Ticket Médio</p>
                    <p className="text-lg font-bold">R$ {selected.ticketMedio}</p>
                  </Card>
                  <Card className="border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Cupons</p>
                    <p className="text-lg font-bold text-primary">{selected.cuponsAcumulados}</p>
                  </Card>
                  <Card className="border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Saldo acumulado</p>
                    <p className="text-lg font-bold">R$ {selected.saldoAcumulado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </Card>
                  <Card className="border-border bg-amber-500/10 border-amber-500/30 p-3">
                    <p className="text-xs text-muted-foreground">Falta pro próximo cupom</p>
                    <p className="text-lg font-bold text-amber-500">R$ {selected.faltaProximoCupom.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </Card>
                  <Card className="border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Dias s/ pedido</p>
                    <p className="text-lg font-bold">{selected.diasDesdeUltimoPedido !== null ? `${selected.diasDesdeUltimoPedido}d` : "-"}</p>
                  </Card>
                  <Card className="border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Frequência</p>
                    <p className="text-lg font-bold">{selected.intervaloMedio > 0 ? `a cada ${selected.intervaloMedio}d` : "—"}</p>
                  </Card>
                </div>
                <div className="rounded-md bg-muted/30 border border-border p-3 text-sm">
                  🏆 <strong>{getRankingPosition(selected.id)}°</strong> lugar no ranking do sorteio com <strong className="text-primary">{selected.cuponsAcumulados}</strong> cupons
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm mb-2">Histórico de Pedidos</h3>
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Pizzaria</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Canal</TableHead>
                          <TableHead className="text-right">Cupons</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selected.pedidos.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs">{format(p.data, "dd/MM/yy")}</TableCell>
                            <TableCell className="text-xs">{p.pizzariaNome}</TableCell>
                            <TableCell className="text-right text-xs">R$ {p.valor}</TableCell>
                            <TableCell className="text-xs">{p.canalVenda}</TableCell>
                            <TableCell className="text-right text-xs font-bold text-primary">{p.cuponsGerados}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* BLOCO 5 — Gráficos: linha 1 (Novos por dia + Top consumidores) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Novos Consumidores por Dia — AreaChart estilo Dashboard */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-heading">Novos Consumidores por Dia</CardTitle>
              <p className="text-xs text-muted-foreground">{chartPeriodLabel}</p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {chartPeriodLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-3" align="end">
                <p className="text-xs font-medium text-muted-foreground">Período</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(QUICK_LABELS) as NonNullable<QuickPeriod>[]).map((p) => (
                    <Button key={p} variant={chartQuick === p ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => selectChartQuick(p)}>
                      {QUICK_LABELS[p]}
                    </Button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Personalizado</p>
                  <div className="flex items-center gap-1">
                    <Input type="date" className="h-7 text-xs" value={chartCustomFromStr} onChange={(e) => setChartCustomFromStr(e.target.value)} />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input type="date" className="h-7 text-xs" value={chartCustomToStr} onChange={(e) => setChartCustomToStr(e.target.value)} />
                  </div>
                  <Button size="sm" className="text-xs h-7 w-full" onClick={applyChartCustom} disabled={!chartCustomFromStr || !chartCustomToStr}>Aplicar</Button>
                </div>
              </PopoverContent>
            </Popover>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ novos: { label: "Novos", color: "hsl(25 95% 53%)" } }} className="h-[220px] w-full">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="gradNovos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(25 95% 53%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(25 95% 53%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(220 10% 55%)" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="hsl(220 10% 55%)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="novos" stroke="hsl(25 95% 53%)" strokeWidth={2} fill="url(#gradNovos)" dot={false} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Ranking Consumidores */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-heading">Ranking Consumidores</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Top 10 por cupons acumulados</p>
          </CardHeader>
          <CardContent>
            {topConsumidoresData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dado disponível.</p>
            ) : (() => {
              const maxCupons = topConsumidoresData[0].cupons;
              return (
                <div className="space-y-3 max-h-[255px] overflow-y-auto pr-1">
                  {topConsumidoresData.map((item, idx) => {
                    const pct = maxCupons > 0 ? Math.round((item.cupons / maxCupons) * 100) : 0;
                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            {idx < 3 ? (
                              <Badge className={`${medalColors[idx]} text-xs px-1.5 shrink-0`}>{idx + 1}º</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground w-6 text-center shrink-0">{idx + 1}º</span>
                            )}
                            <span className="font-medium text-sm truncate">{item.nome}</span>
                          </div>
                          <span className="text-sm font-heading font-bold text-primary shrink-0 ml-2">
                            {item.cupons} cupons
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* BLOCO 6 — Gráficos: linha 2 (Distribuição por cidade + Ticket médio) */}
      {cidadeDistData.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Distribuição por Cidade */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading">Distribuição por Cidade</CardTitle>
              <p className="text-xs text-muted-foreground">Consumidores por cidade cadastrada</p>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <ChartContainer config={{ count: { label: "Consumidores" } }} className="h-[200px] w-[200px] shrink-0">
                <PieChart>
                  <Pie data={cidadeDistData} dataKey="count" nameKey="cidade" cx="50%" cy="50%" outerRadius={80} innerRadius={44} paddingAngle={3}>
                    {cidadeDistData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                {cidadeDistData.map((item, i) => (
                  <div key={item.cidade} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="truncate text-muted-foreground">{item.cidade}</span>
                    </div>
                    <span className="font-medium shrink-0">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Frequência de Compras */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading">Frequência de Compras</CardTitle>
              <p className="text-xs text-muted-foreground">Distribuição por intervalo médio entre pedidos</p>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <ChartContainer config={{ count: { label: "Consumidores" } }} className="h-[200px] w-[200px] shrink-0">
                <PieChart>
                  <Pie data={frequenciaData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={44} paddingAngle={3}>
                    {frequenciaData.map((item, i) => <Cell key={i} fill={item.color} />)}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                {frequenciaData.map((item) => {
                  const total = frequenciaData.reduce((s, x) => s + x.count, 0);
                  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: item.color }} />
                        <span className="truncate text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-medium shrink-0">{item.count} <span className="text-muted-foreground">({pct}%)</span></span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal — Adicionar Consumidor */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) setAddOpen(false); }}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Consumidor</DialogTitle>
            <DialogDescription>Preencha os dados para cadastrar manualmente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input value={newNome} onChange={(e) => setNewNome(e.target.value)} placeholder="Nome do consumidor" />
            </div>
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input value={newCpf} onChange={(e) => setNewCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone / WhatsApp</Label>
              <Input value={newTelefone} onChange={(e) => setNewTelefone(e.target.value)} placeholder="(00) 90000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={newEstado} onValueChange={handleNewEstado}>
                <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
                <SelectContent>
                  {BRASIL_ESTADOS.map((e) => (
                    <SelectItem key={e.uf} value={e.uf}>{e.nome} ({e.uf})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Select value={newCidade} onValueChange={setNewCidade} disabled={!newEstado || addCidadesLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={addCidadesLoading ? "Carregando..." : newEstado ? "Selecione a cidade" : "Selecione o estado primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {addCidades.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input value={newBairro} onChange={(e) => setNewBairro(e.target.value)} placeholder="Bairro" />
            </div>
            <div className="space-y-1.5">
              <Label>Pizzaria vinculada</Label>
              <Select value={newPizzaria} onValueChange={setNewPizzaria}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {pizzarias.filter((p) => p.status === "Ativa").map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Senha inicial</Label>
              <div className="relative">
                <Input type={showSenha ? "text" : "password"} value={newSenha} onChange={(e) => setNewSenha(e.target.value)} placeholder="Senha" />
                <button type="button" className="absolute right-2 top-2.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowSenha(!showSenha)}>
                  {showSenha ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <Switch checked={newAceitaWhatsapp} onCheckedChange={setNewAceitaWhatsapp} />
            <span className="text-sm">Permitir envio de mensagens (WhatsApp)</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 mt-2">
            <div className="space-y-1.5">
              <Label>Gênero</Label>
              <Select value={newGenero} onValueChange={setNewGenero}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                  <SelectItem value="nao_informar">Prefiro não informar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Input type="date" value={newDataNascimento} onChange={(e) => setNewDataNascimento(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <Switch checked={sendBoasVindas} onCheckedChange={setSendBoasVindas} />
            <span className="text-sm flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> Enviar mensagem de boas-vindas via WhatsApp
            </span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!newNome.trim() || !newEmail.trim() || !newSenha.trim()) {
                toast({ title: "Preencha nome, e-mail e senha", variant: "destructive" });
                return;
              }
              try {
                const res = await supabase.functions.invoke("create-user", {
                  body: {
                    email: newEmail.trim().toLowerCase(),
                    password: newSenha,
                    nome: newNome.trim(),
                    cpf: newCpf || null,
                    telefone: newTelefone || null,
                    perfil: "consumidor",
                    extra: {
                      cidade: newCidade || null,
                      bairro: newBairro || null,
                      pizzariaId: newPizzaria || null,
                      genero: newGenero || null,
                      dataNascimento: newDataNascimento || null,
                      aceitaWhatsapp: newAceitaWhatsapp,
                    },
                  },
                });
                if (res.error || res.data?.error) {
                  toast({ title: "Erro ao cadastrar", description: res.data?.error || res.error?.message, variant: "destructive" });
                } else {
                  toast({ title: "Consumidor cadastrado com sucesso!" });
                  setAddOpen(false);
                }
              } catch (err: any) {
                toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
              }
            }} disabled={!newNome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

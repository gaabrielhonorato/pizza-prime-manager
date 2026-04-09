import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Users, UserCheck, Ticket, Crown, Search, ChevronDown, ChevronUp,
  Download, Eye, Pencil, Trash2, Filter, X, CalendarIcon, Plus, MessageCircle,
} from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfMonth, subMonths, endOfMonth, addDays, eachDayOfInterval, isSameDay } from "date-fns";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { usePizzarias } from "@/contexts/PizzariasContext";
import { useConsumidoresData, type ConsumidorData } from "@/hooks/useConsumidoresData";
import { cn } from "@/lib/utils";
import ExportButton from "@/components/gestor/ExportButton";

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
  "7dias": "Últimos 7 dias",
  "30dias": "Últimos 30 dias",
  este_mes: "Este mês",
  mes_anterior: "Mês anterior",
};

export default function Consumidores() {
  const navigate = useNavigate();
  const { pizzarias } = usePizzarias();
  const { data, loading: consumidoresLoading } = useConsumidoresData();

  // Filters
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
  const [filterPrimeiroPedidoDe, setFilterPrimeiroPedidoDe] = useState<Date | undefined>();
  const [filterPrimeiroPedidoAte, setFilterPrimeiroPedidoAte] = useState<Date | undefined>();
  const [filterUltimoPedidoDe, setFilterUltimoPedidoDe] = useState<Date | undefined>();
  const [filterUltimoPedidoAte, setFilterUltimoPedidoAte] = useState<Date | undefined>();
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [showFilters, setShowFilters] = useState(false);

  // Table
  const [sortKey, setSortKey] = useState<SortKey>("cupons");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  // Detail drawer (kept for fallback but main flow navigates)
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

  // Chart period
  const [chartQuick, setChartQuick] = useState<QuickPeriod>("este_mes");
  const [chartFrom, setChartFrom] = useState<Date>(startOfMonth(new Date()));
  const [chartTo, setChartTo] = useState<Date>(endOfDay(new Date()));
  const [chartCustomFrom, setChartCustomFrom] = useState<Date | undefined>();
  const [chartCustomTo, setChartCustomTo] = useState<Date | undefined>();

  const selectChartQuick = (p: NonNullable<QuickPeriod>) => {
    setChartQuick(p);
    const [f, t] = getQuickRange(p);
    setChartFrom(f); setChartTo(t);
    setChartCustomFrom(f); setChartCustomTo(t);
  };
  const applyChartCustom = () => {
    if (chartCustomFrom && chartCustomTo) {
      setChartQuick(null);
      setChartFrom(startOfDay(chartCustomFrom));
      setChartTo(endOfDay(chartCustomTo));
    }
  };

  // Derived: cities / bairros
  const cidades = useMemo(() => [...new Set(data.map((c) => c.cidade))].sort(), [data]);
  const bairros = useMemo(() => {
    if (filterCidade === "all") return [...new Set(data.map((c) => c.bairro))].sort();
    return [...new Set(data.filter((c) => c.cidade === filterCidade).map((c) => c.bairro))].sort();
  }, [data, filterCidade]);

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
    if (filterPrimeiroPedidoDe && filterPrimeiroPedidoAte) {
      list = list.filter((c) => c.primeiroPedido && isWithinInterval(c.primeiroPedido, { start: startOfDay(filterPrimeiroPedidoDe), end: endOfDay(filterPrimeiroPedidoAte) }));
    }
    if (filterUltimoPedidoDe && filterUltimoPedidoAte) {
      list = list.filter((c) => c.ultimoPedido && isWithinInterval(c.ultimoPedido, { start: startOfDay(filterUltimoPedidoDe), end: endOfDay(filterUltimoPedidoAte) }));
    }
    if (filterStatus !== "Todos") list = list.filter((c) => c.status === filterStatus);
    return list;
  }, [data, searchText, filterPizzaria, filterCidade, filterBairro, filterCuponsMin, filterCuponsMax, filterPedidosMin, filterPedidosMax, filterTicketMin, filterTicketMax, filterPrimeiroPedidoDe, filterPrimeiroPedidoAte, filterUltimoPedidoDe, filterUltimoPedidoAte, filterStatus]);

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
    setFilterPrimeiroPedidoDe(undefined); setFilterPrimeiroPedidoAte(undefined);
    setFilterUltimoPedidoDe(undefined); setFilterUltimoPedidoAte(undefined);
    setFilterStatus("Todos"); setPage(1);
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

  // Chart data
  const chartData = useMemo(() => {
    const interval = { start: startOfDay(chartFrom), end: endOfDay(chartTo) };
    const days = eachDayOfInterval(interval);
    return days.map((day) => ({
      label: format(day, "dd/MM"),
      novos: data.filter((c) => isSameDay(c.dataCadastro, day)).length,
    }));
  }, [data, chartFrom, chartTo]);

  // CSV export
  const exportCSV = () => {
    const header = "Nome,CPF,Telefone,Cidade,Bairro,Pizzaria,Total Pedidos,Ticket Médio,Total Gasto,Cupons,Primeiro Pedido,Último Pedido,Status";
    const rows = sorted.map((c) =>
      [c.nome, c.cpf, c.telefone, c.cidade, c.bairro, c.pizzariaVinculadaNome, c.totalPedidos,
        `R$ ${c.ticketMedio}`, `R$ ${c.totalGasto}`, c.cuponsAcumulados,
        c.primeiroPedido ? format(c.primeiroPedido, "dd/MM/yyyy") : "-",
        c.ultimoPedido ? format(c.ultimoPedido, "dd/MM/yyyy") : "-", c.status,
      ].join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "consumidores.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const DateFilter = ({ label, value, onChange }: { label: string; value?: Date; onChange: (d: Date | undefined) => void }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("text-xs h-8 w-[130px] justify-start", !value && "text-muted-foreground")}>
          <CalendarIcon className="mr-1 h-3 w-3" />
          {value ? format(value, "dd/MM/yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );

  const resetAddForm = () => {
    setNewNome(""); setNewCpf(""); setNewEmail(""); setNewTelefone("");
    setNewCidade(""); setNewBairro(""); setNewPizzaria(""); setNewSenha("");
    setShowSenha(false); setSendBoasVindas(true);
  };

  return (
    <div className="space-y-6">
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
              cidade: c.cidade, bairro: c.bairro, totalPedidos: c.totalPedidos,
              totalGasto: `R$ ${c.totalGasto}`, cupons: c.cuponsAcumulados,
              dataCadastro: format(c.dataCadastro, "dd/MM/yyyy"), status: c.status,
            }))}
            columns={[
              { key: "nome", label: "Nome" }, { key: "telefone", label: "Telefone" },
              { key: "email", label: "E-mail" }, { key: "cpf", label: "CPF" },
              { key: "cidade", label: "Cidade" }, { key: "bairro", label: "Bairro" },
              { key: "totalPedidos", label: "Total Pedidos" }, { key: "totalGasto", label: "Total Gasto" },
              { key: "cupons", label: "Cupons" }, { key: "dataCadastro", label: "Data Cadastro" },
              { key: "status", label: "Status" },
            ]}
            fileName="consumidores"
            metaAds={{
              enabled: true,
              mapping: { phone: "telefone", email: "email", fn: "nome", ct: "cidade" },
              getData: () => sorted.map(c => ({ telefone: c.telefone, email: c.email, nome: c.nome, cidade: c.cidade })),
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

      {/* BLOCO 2 — Filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="mr-1 h-4 w-4" /> {showFilters ? "Ocultar Filtros" : "Mostrar Filtros"}
          </Button>
          <span className="text-sm text-muted-foreground">
            Exibindo {sorted.length === data.length ? data.length : `${sorted.length} de ${data.length}`} consumidores
          </span>
        </div>

        <Collapsible open={showFilters}>
          <CollapsibleContent>
            <Card className="border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {/* Pizzaria */}
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
                {/* Cidade */}
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
                {/* Bairro */}
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
                {/* Status */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todos</SelectItem>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Cupons range */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Cupons (min – máx)</label>
                  <div className="flex gap-1">
                    <Input type="number" placeholder="Min" className="h-8 text-xs" value={filterCuponsMin} onChange={(e) => { setFilterCuponsMin(e.target.value); setPage(1); }} />
                    <Input type="number" placeholder="Máx" className="h-8 text-xs" value={filterCuponsMax} onChange={(e) => { setFilterCuponsMax(e.target.value); setPage(1); }} />
                  </div>
                </div>
                {/* Pedidos range */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Pedidos (min – máx)</label>
                  <div className="flex gap-1">
                    <Input type="number" placeholder="Min" className="h-8 text-xs" value={filterPedidosMin} onChange={(e) => { setFilterPedidosMin(e.target.value); setPage(1); }} />
                    <Input type="number" placeholder="Máx" className="h-8 text-xs" value={filterPedidosMax} onChange={(e) => { setFilterPedidosMax(e.target.value); setPage(1); }} />
                  </div>
                </div>
                {/* Ticket range */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Ticket Médio R$ (min – máx)</label>
                  <div className="flex gap-1">
                    <Input type="number" placeholder="Min" className="h-8 text-xs" value={filterTicketMin} onChange={(e) => { setFilterTicketMin(e.target.value); setPage(1); }} />
                    <Input type="number" placeholder="Máx" className="h-8 text-xs" value={filterTicketMax} onChange={(e) => { setFilterTicketMax(e.target.value); setPage(1); }} />
                  </div>
                </div>
                {/* Primeiro pedido */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Primeiro Pedido</label>
                  <div className="flex gap-1">
                    <DateFilter label="De" value={filterPrimeiroPedidoDe} onChange={(d) => { setFilterPrimeiroPedidoDe(d); setPage(1); }} />
                    <DateFilter label="Até" value={filterPrimeiroPedidoAte} onChange={(d) => { setFilterPrimeiroPedidoAte(d); setPage(1); }} />
                  </div>
                </div>
                {/* Último pedido */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Último Pedido</label>
                  <div className="flex gap-1">
                    <DateFilter label="De" value={filterUltimoPedidoDe} onChange={(d) => { setFilterUltimoPedidoDe(d); setPage(1); }} />
                    <DateFilter label="Até" value={filterUltimoPedidoAte} onChange={(d) => { setFilterUltimoPedidoAte(d); setPage(1); }} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" onClick={() => setPage(1)}>Aplicar Filtros</Button>
                <Button size="sm" variant="outline" onClick={clearFilters}>Limpar Filtros</Button>
              </div>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* BLOCO 3 — Table */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-heading">Lista de Consumidores</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cupons">Mais cupons</SelectItem>
                <SelectItem value="pedidos">Mais pedidos</SelectItem>
                <SelectItem value="gasto">Maior gasto</SelectItem>
                <SelectItem value="recente">Cadastro recente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[90px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 30, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} / pág</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="text-xs" onClick={exportCSV}>
              <Download className="mr-1 h-3 w-3" /> Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade / Bairro</TableHead>
                  <TableHead>Aniversário</TableHead>
                  <TableHead>Pizzaria</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead className="text-right">Total Gasto</TableHead>
                  <TableHead className="text-right">Cupons</TableHead>
                  <TableHead>1º Pedido</TableHead>
                  <TableHead>Último Pedido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-xs">{c.cpf}</TableCell>
                    <TableCell className="text-xs">{c.telefone}</TableCell>
                    <TableCell className="text-xs">{c.cidade} / {c.bairro}</TableCell>
                    <TableCell className="text-xs">
                      {c.dataNascimento ? (
                        <>
                          {format(c.dataNascimento, "dd/MM")}
                          {c.dataNascimento.getMonth() === new Date().getMonth() && (
                            <span className="ml-1" title="Aniversariante do mês">🎂</span>
                          )}
                        </>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{c.pizzariaVinculadaNome}</TableCell>
                    <TableCell className="text-right">{c.totalPedidos}</TableCell>
                    <TableCell className="text-right">R$ {c.ticketMedio}</TableCell>
                    <TableCell className="text-right">R$ {c.totalGasto.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{c.cuponsAcumulados}</TableCell>
                    <TableCell className="text-xs">{c.primeiroPedido ? format(c.primeiroPedido, "dd/MM/yy") : "-"}</TableCell>
                    <TableCell className="text-xs">{c.ultimoPedido ? format(c.ultimoPedido, "dd/MM/yy") : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "Ativo" ? "default" : "secondary"} className="text-xs">
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(c)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/gestor/consumidores/${c.id}`)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir consumidor?</AlertDialogTitle>
                              <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction>Confirmar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Pagination */}
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
                <SheetTitle className="font-heading">{selected.nome}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-6">
                {/* Personal */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">CPF:</span> {selected.cpf}</div>
                  <div><span className="text-muted-foreground">E-mail:</span> {selected.email}</div>
                  <div><span className="text-muted-foreground">Telefone:</span> {selected.telefone}</div>
                  <div><span className="text-muted-foreground">Cidade:</span> {selected.cidade}</div>
                  <div><span className="text-muted-foreground">Bairro:</span> {selected.bairro}</div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant={selected.status === "Ativo" ? "default" : "secondary"} className="text-xs">{selected.status}</Badge></div>
                </div>
                {/* Summary */}
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
                </div>
                {/* Ranking */}
                <div className="rounded-md bg-muted/30 border border-border p-3 text-sm">
                  🏆 <strong>{getRankingPosition(selected.id)}°</strong> lugar no ranking do sorteio com <strong className="text-primary">{selected.cuponsAcumulados}</strong> cupons
                </div>
                {/* Order history */}
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

      {/* BLOCO 5 — New consumers chart */}
      <Card className="border-border bg-card">
        <CardHeader className="space-y-3">
          <CardTitle className="text-base font-heading">📊 Novos Consumidores por Dia</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(QUICK_LABELS) as NonNullable<QuickPeriod>[]).map((p) => (
              <Button key={p} variant={chartQuick === p ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => selectChartQuick(p)}>
                {QUICK_LABELS[p]}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("text-xs h-8 w-[130px] justify-start", !chartCustomFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {chartCustomFrom ? format(chartCustomFrom, "dd/MM/yyyy") : "Data inicial"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={chartCustomFrom} onSelect={setChartCustomFrom} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("text-xs h-8 w-[130px] justify-start", !chartCustomTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {chartCustomTo ? format(chartCustomTo, "dd/MM/yyyy") : "Data final"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={chartCustomTo} onSelect={setChartCustomTo} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Button size="sm" className="text-xs h-8" onClick={applyChartCustom} disabled={!chartCustomFrom || !chartCustomTo}>Aplicar</Button>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ novos: { label: "Novos Consumidores", color: "hsl(25 95% 53%)" } }} className="h-[250px] w-full">
            <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
              <XAxis dataKey="label" stroke="hsl(220 10% 55%)" fontSize={11} interval="preserveStartEnd" />
              <YAxis stroke="hsl(220 10% 55%)" fontSize={12} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="novos" fill="hsl(25 95% 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

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
              <Label>Cidade</Label>
              <Input value={newCidade} onChange={(e) => setNewCidade(e.target.value)} placeholder="Cidade" />
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

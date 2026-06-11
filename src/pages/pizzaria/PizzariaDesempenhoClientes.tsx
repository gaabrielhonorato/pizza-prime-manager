import { useState, useMemo, useEffect } from "react";
import {
  format, subDays, subWeeks, subMonths,
  startOfWeek, endOfWeek, startOfDay, endOfDay,
  startOfMonth, endOfMonth, differenceInDays, eachWeekOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Users, UserPlus, Activity, Clock, SlidersHorizontal,
  Download, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useMinhaPizzaria } from "@/contexts/MinhaPizzariaContext";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter } from "@/lib/pdf-helpers";

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────
const RECURRENCE_COLORS = ["#6b7280", "#f97316", "#3b82f6", "#10b981", "#8b5cf6"];

type QuickPeriod = "campanha" | "este_mes" | "mes_anterior" | "3m" | "6m" | "custom";
const QUICK_LABELS: Record<Exclude<QuickPeriod, "custom">, string> = {
  campanha: "Toda a campanha",
  este_mes: "Este mês",
  mes_anterior: "Mês anterior",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
};

function getQuickRange(p: Exclude<QuickPeriod, "campanha" | "custom">): [Date, Date] {
  const now = new Date();
  switch (p) {
    case "este_mes": return [startOfMonth(now), endOfDay(now)];
    case "mes_anterior": return [startOfMonth(subMonths(now, 1)), endOfMonth(subMonths(now, 1))];
    case "3m": return [startOfDay(subMonths(now, 3)), endOfDay(now)];
    case "6m": return [startOfDay(subMonths(now, 6)), endOfDay(now)];
  }
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
type Consumer = {
  id: string; usuario_id: string; criado_em: string;
  genero: string | null; data_nascimento: string | null;
  aceita_whatsapp: boolean;
};
type Usuario = { id: string; nome: string; telefone: string | null; ultimo_acesso: string | null };
type Pedido = {
  id: string; consumidor_id: string | null; data_pedido: string;
  valor_total: number; canal: string | null;
};

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────
export default function PizzariaDesempenhoClientes() {
  const { pizzaria, loading: pizzariaLoading } = useMinhaPizzaria();

  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filtros
  const [filterOpen, setFilterOpen] = useState(false);
  const [quick, setQuick] = useState<QuickPeriod>("este_mes");
  const [customFromStr, setCustomFromStr] = useState("");
  const [customToStr, setCustomToStr] = useState("");
  const [generoFilter, setGeneroFilter] = useState<string[]>([]);
  const [minPedidos, setMinPedidos] = useState("");
  const [maxPedidos, setMaxPedidos] = useState("");
  const [minGasto, setMinGasto] = useState("");
  const [maxGasto, setMaxGasto] = useState("");

  // ── Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // ─── Fetch ─────────────────────────────────────────────────
  useEffect(() => {
    if (!pizzaria?.id) return;
    const load = async () => {
      setLoading(true);
      const [cRes, pRes] = await Promise.all([
        supabase
          .from("consumidores")
          .select("id, usuario_id, criado_em, genero, data_nascimento, aceita_whatsapp")
          .eq("pizzaria_id", pizzaria.id),
        supabase
          .from("pedidos")
          .select("id, consumidor_id, data_pedido, valor_total, canal")
          .eq("pizzaria_id", pizzaria.id)
          .order("data_pedido", { ascending: false })
          .limit(5000),
      ]);
      const consumidorList = (cRes.data as Consumer[]) || [];
      const pedidoList = (pRes.data as Pedido[]) || [];

      // Busca usuários apenas dos consumidores encontrados
      const uIds = [...new Set(consumidorList.map(c => c.usuario_id))];
      let usuarioList: Usuario[] = [];
      if (uIds.length > 0) {
        const uRes = await supabase
          .from("usuarios")
          .select("id, nome, telefone, ultimo_acesso")
          .in("id", uIds);
        usuarioList = (uRes.data as Usuario[]) || [];
      }

      setConsumers(consumidorList);
      setUsuarios(usuarioList);
      setPedidos(pedidoList);
      setLoading(false);
    };
    load();
  }, [pizzaria?.id]);

  // ─── Date range ────────────────────────────────────────────
  const dateRange = useMemo((): [Date, Date] | null => {
    if (quick === "campanha") return null;
    if (quick === "custom") {
      if (customFromStr && customToStr) {
        const from = startOfDay(new Date(customFromStr));
        const to = endOfDay(new Date(customToStr));
        if (!isNaN(from.getTime()) && !isNaN(to.getTime())) return [from, to];
      }
      return null;
    }
    return getQuickRange(quick as Exclude<QuickPeriod, "campanha" | "custom">);
  }, [quick, customFromStr, customToStr]);

  const periodoLabel =
    quick === "custom" && dateRange
      ? `${format(dateRange[0], "dd/MM")} – ${format(dateRange[1], "dd/MM")}`
      : QUICK_LABELS[quick as Exclude<QuickPeriod, "custom">] ?? "Personalizado";

  // ─── Enrich consumers ──────────────────────────────────────
  const enriched = useMemo(() => {
    const uMap = new Map(usuarios.map(u => [u.id, u]));
    const now = new Date();

    return consumers.map(c => {
      const u = uMap.get(c.usuario_id);
      let cPedidos = pedidos.filter(p => p.consumidor_id === c.id);

      if (dateRange) {
        const [from, to] = dateRange;
        cPedidos = cPedidos.filter(p => {
          const t = new Date(p.data_pedido).getTime();
          return t >= from.getTime() && t <= to.getTime();
        });
      }

      const totalGasto = cPedidos.reduce((s, p) => s + p.valor_total, 0);
      const totalPedidos = cPedidos.length;
      const ticket = totalPedidos > 0 ? totalGasto / totalPedidos : 0;
      const lastOrder = cPedidos.length > 0 ? cPedidos[0].data_pedido : null;
      const daysSinceLastOrder = lastOrder ? differenceInDays(now, new Date(lastOrder)) : null;

      let avgInterval = 0;
      if (cPedidos.length > 1) {
        const sorted = [...cPedidos].sort(
          (a, b) => new Date(a.data_pedido).getTime() - new Date(b.data_pedido).getTime()
        );
        let totalDiff = 0;
        for (let i = 1; i < sorted.length; i++)
          totalDiff += differenceInDays(new Date(sorted[i].data_pedido), new Date(sorted[i - 1].data_pedido));
        avgInterval = totalDiff / (sorted.length - 1);
      }

      return {
        ...c,
        nome: u?.nome || "—",
        telefone: u?.telefone || null,
        ultimo_acesso: u?.ultimo_acesso || null,
        totalPedidos, totalGasto, ticket, lastOrder, daysSinceLastOrder, avgInterval,
      };
    });
  }, [consumers, usuarios, pedidos, dateRange]);

  // ─── Filtros avançados ─────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...enriched];
    if (generoFilter.length > 0) list = list.filter(c => c.genero && generoFilter.includes(c.genero));
    if (minPedidos) list = list.filter(c => c.totalPedidos >= parseInt(minPedidos));
    if (maxPedidos) list = list.filter(c => c.totalPedidos <= parseInt(maxPedidos));
    if (minGasto) list = list.filter(c => c.totalGasto >= parseFloat(minGasto));
    if (maxGasto) list = list.filter(c => c.totalGasto <= parseFloat(maxGasto));
    return list;
  }, [enriched, generoFilter, minPedidos, maxPedidos, minGasto, maxGasto]);

  const hasActiveFilters =
    generoFilter.length > 0 ||
    !!minPedidos || !!maxPedidos ||
    !!minGasto || !!maxGasto ||
    quick !== "este_mes";

  const activeFilterCount = [
    generoFilter.length > 0,
    !!minPedidos || !!maxPedidos,
    !!minGasto || !!maxGasto,
    quick !== "este_mes",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setQuick("este_mes");
    setCustomFromStr(""); setCustomToStr("");
    setGeneroFilter([]);
    setMinPedidos(""); setMaxPedidos("");
    setMinGasto(""); setMaxGasto("");
    setCurrentPage(1);
  };

  // ─── KPIs ──────────────────────────────────────────────────
  const now = new Date();
  const totalClientes = filtered.length;
  const clientesAtivos = filtered.filter(c => c.totalPedidos > 0).length;
  const novosEstaSemana = useMemo(() => {
    const from = startOfWeek(now, { weekStartsOn: 1 });
    return consumers.filter(c => new Date(c.criado_em) >= from).length;
  }, [consumers]);
  const novosEsteMes = useMemo(() => {
    const from = startOfMonth(now);
    return consumers.filter(c => new Date(c.criado_em) >= from).length;
  }, [consumers]);

  // ─── Novos clientes por semana ─────────────────────────────
  const weeklyNewData = useMemo(() => {
    const range = dateRange ?? [
      startOfDay(subMonths(now, 3)),
      endOfDay(now),
    ] as [Date, Date];
    const weeks = eachWeekOfInterval({ start: range[0], end: range[1] }, { weekStartsOn: 1 });
    return weeks.map(wStart => {
      const wEnd = endOfWeek(wStart, { weekStartsOn: 1 });
      const count = consumers.filter(c => {
        const d = new Date(c.criado_em);
        return d >= wStart && d <= wEnd;
      }).length;
      return { label: format(wStart, "dd/MM", { locale: ptBR }), novos: count };
    });
  }, [consumers, dateRange]);

  // ─── Recorrência ───────────────────────────────────────────
  const recurrenceData = useMemo(() => {
    const groups: Record<string, number> = {
      "1 pedido": 0,
      "2–3 pedidos": 0,
      "4–6 pedidos": 0,
      "7–10 pedidos": 0,
      "11+ pedidos": 0,
    };
    filtered.forEach(c => {
      if (c.totalPedidos === 0) return;
      if (c.totalPedidos === 1) groups["1 pedido"]++;
      else if (c.totalPedidos <= 3) groups["2–3 pedidos"]++;
      else if (c.totalPedidos <= 6) groups["4–6 pedidos"]++;
      else if (c.totalPedidos <= 10) groups["7–10 pedidos"]++;
      else groups["11+ pedidos"]++;
    });
    return Object.entries(groups)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // ─── Paginação ─────────────────────────────────────────────
  const sortedFiltered = useMemo(
    () => [...filtered].sort((a, b) => b.totalGasto - a.totalGasto),
    [filtered]
  );
  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const pagedList = sortedFiltered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => setCurrentPage(1), [filtered]);

  // ─── Exports ───────────────────────────────────────────────
  const today = format(new Date(), "yyyy-MM-dd");
  const pizzariaNome = pizzaria?.nome ?? "Pizzaria";

  async function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const lettering = await loadLetteringDataUrl();
    const filterLines = [`Período: ${periodoLabel}`];
    if (generoFilter.length) filterLines.push(`Gênero: ${generoFilter.join(", ")}`);
    let y = buildPdfHeader(doc, "Desempenho de Clientes", pizzariaNome, filterLines, lettering);
    y += 10;

    doc.setFontSize(8).setTextColor(...C.slate500);
    doc.text(`Total: ${filtered.length} clientes`, 20, y);
    y += 14;

    autoTable(doc, {
      startY: y,
      head: [["Cliente", "Telefone", "Cadastro", "Pedidos", "Total Gasto", "Ticket Médio", "Último Pedido"]],
      body: sortedFiltered.map(c => [
        c.nome,
        c.telefone || "—",
        format(new Date(c.criado_em), "dd/MM/yyyy"),
        c.totalPedidos,
        fmt(c.totalGasto),
        fmt(c.ticket),
        c.lastOrder ? format(new Date(c.lastOrder), "dd/MM/yyyy") : "—",
      ]),
      ...TABLE_STYLES,
    });
    addPdfFooter(doc);
    doc.save(`clientes_${pizzariaNome.replace(/\s/g, "_")}_${today}.pdf`);
  }

  function exportExcel() {
    const rows = sortedFiltered.map(c => ({
      "Cliente": c.nome,
      "Telefone": c.telefone || "",
      "Cadastro": format(new Date(c.criado_em), "dd/MM/yyyy"),
      "Pedidos": c.totalPedidos,
      "Total Gasto": c.totalGasto,
      "Ticket Médio": parseFloat(c.ticket.toFixed(2)),
      "Último Pedido": c.lastOrder ? format(new Date(c.lastOrder), "dd/MM/yyyy") : "",
      "Dias sem pedir": c.daysSinceLastOrder ?? "",
      "Intervalo médio (dias)": parseFloat(c.avgInterval.toFixed(1)),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, `clientes_${pizzariaNome.replace(/\s/g, "_")}_${today}.xlsx`);
  }

  function exportCSV() {
    const header = ["Cliente", "Telefone", "Cadastro", "Pedidos", "Total Gasto", "Ticket Médio", "Último Pedido"];
    const rows = sortedFiltered.map(c => [
      c.nome, c.telefone || "", format(new Date(c.criado_em), "dd/MM/yyyy"),
      c.totalPedidos, c.totalGasto.toFixed(2), c.ticket.toFixed(2),
      c.lastOrder ? format(new Date(c.lastOrder), "dd/MM/yyyy") : "",
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `clientes_${pizzariaNome.replace(/\s/g, "_")}_${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const toggleGenero = (v: string) =>
    setGeneroFilter(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  if (pizzariaLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">{periodoLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtros */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 relative">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-primary text-primary-foreground">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0" side="bottom">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-sm font-medium">Filtros</span>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <X className="h-3 w-3" /> Limpar
                  </button>
                )}
              </div>

              <div className="p-4 space-y-4 max-h-[480px] overflow-y-auto">
                {/* Período */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Período de pedidos</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(Object.keys(QUICK_LABELS) as Exclude<QuickPeriod, "custom">[]).map(k => (
                      <button
                        key={k}
                        onClick={() => setQuick(k)}
                        className={`px-2 py-0.5 rounded text-xs border transition-colors ${quick === k ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                      >
                        {QUICK_LABELS[k]}
                      </button>
                    ))}
                    <button
                      onClick={() => setQuick("custom")}
                      className={`px-2 py-0.5 rounded text-xs border transition-colors ${quick === "custom" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                    >
                      Personalizado
                    </button>
                  </div>
                  {quick === "custom" && (
                    <div className="flex gap-2">
                      <Input type="date" value={customFromStr} onChange={e => setCustomFromStr(e.target.value)} className="h-7 text-xs" />
                      <Input type="date" value={customToStr} onChange={e => setCustomToStr(e.target.value)} className="h-7 text-xs" />
                    </div>
                  )}
                </div>

                {/* Gênero */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Gênero</p>
                  <div className="flex gap-3">
                    {["M", "F", "outro"].map(g => (
                      <label key={g} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={generoFilter.includes(g)}
                          onCheckedChange={() => toggleGenero(g)}
                          className="h-3.5 w-3.5"
                        />
                        {g === "M" ? "Masc." : g === "F" ? "Fem." : "Outro"}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Nº de pedidos */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Nº de pedidos</p>
                  <div className="flex gap-2 items-center">
                    <Input placeholder="Mín" value={minPedidos} onChange={e => setMinPedidos(e.target.value)} className="h-7 text-xs" />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input placeholder="Máx" value={maxPedidos} onChange={e => setMaxPedidos(e.target.value)} className="h-7 text-xs" />
                  </div>
                </div>

                {/* Total gasto */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Total gasto (R$)</p>
                  <div className="flex gap-2 items-center">
                    <Input placeholder="Mín" value={minGasto} onChange={e => setMinGasto(e.target.value)} className="h-7 text-xs" />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input placeholder="Máx" value={maxGasto} onChange={e => setMaxGasto(e.target.value)} className="h-7 text-xs" />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Exportar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Formato</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportPDF}>PDF (relatório)</DropdownMenuItem>
              <DropdownMenuItem onClick={exportExcel}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={exportCSV}>CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total de clientes</span>
            </div>
            <p className="text-2xl font-semibold">{totalClientes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Clientes ativos</span>
            </div>
            <p className="text-2xl font-semibold">{clientesAtivos}</p>
            {totalClientes > 0 && (
              <p className="text-xs text-muted-foreground">
                {((clientesAtivos / totalClientes) * 100).toFixed(0)}% do total
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Novos esta semana</span>
            </div>
            <p className="text-2xl font-semibold">{novosEstaSemana}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Novos este mês</span>
            </div>
            <p className="text-2xl font-semibold">{novosEsteMes}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Novos clientes por semana */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Novos clientes por semana</CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyNewData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyNewData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11 }}
                    formatter={(v: number) => [v, "Novos clientes"]}
                  />
                  <Bar animationDuration={3000} animationEasing="ease-in-out" dataKey="novos" fill="#f97316" radius={[3, 3, 0, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recorrência */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recorrência de pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            {recurrenceData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <div className="flex gap-4 items-center">
                <div className="flex-shrink-0">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={recurrenceData}
                        cx="50%" cy="50%"
                        innerRadius={50} outerRadius={75}
                        dataKey="value"
                      >
                        {recurrenceData.map((_, i) => (
                          <Cell key={i} fill={RECURRENCE_COLORS[i % RECURRENCE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ fontSize: 11 }}
                        formatter={(v: number) => [v, "clientes"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5">
                  {recurrenceData.map((r, i) => (
                    <div key={r.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ background: RECURRENCE_COLORS[i % RECURRENCE_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{r.name}</span>
                      </div>
                      <span className="font-medium">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lista de clientes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Lista de clientes</CardTitle>
            <span className="text-xs text-muted-foreground">{filtered.length} clientes</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Total gasto</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
                <TableHead className="text-right">Último pedido</TableHead>
                <TableHead className="text-right">Intervalo médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              ) : (
                pagedList.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{c.telefone || "—"}</TableCell>
                    <TableCell className="text-right">{c.totalPedidos}</TableCell>
                    <TableCell className="text-right">{fmt(c.totalGasto)}</TableCell>
                    <TableCell className="text-right">{fmt(c.ticket)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {c.lastOrder ? format(new Date(c.lastOrder), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {c.avgInterval > 0 ? `${c.avgInterval.toFixed(0)}d` : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sortedFiltered.length)} de {sortedFiltered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs px-2">{currentPage} / {totalPages}</span>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

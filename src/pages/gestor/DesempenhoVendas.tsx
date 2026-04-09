import { useState, useMemo, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subMonths, subWeeks, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  eachHourOfInterval, startOfDay, endOfDay, getDay, isWithinInterval, parseISO
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CalendarIcon, ChevronDown, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import ExportButton from "@/components/gestor/ExportButton";

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#6b7280"];
const FORMAS_PAGAMENTO = ["credito", "debito", "pix", "dinheiro", "voucher", "outros"];
const FORMAS_LABELS: Record<string, string> = {
  credito: "Cartão de crédito", debito: "Cartão de débito", pix: "Pix",
  dinheiro: "Dinheiro", voucher: "Voucher", outros: "Outros"
};

type Pedido = {
  id: string; data_pedido: string; valor_total: number; cupons_gerados: number;
  canal: string; status: string; forma_pagamento: string | null;
  tipo_pedido: string | null; taxa_entrega: number; desconto: number;
  bairro_entrega: string | null; horario_pedido: string | null;
  pizzaria_id: string; campanha_id: string;
};

type DesempenhoContext = { selectedPizzaria: string; selectedCampanha: string };

export default function DesempenhoVendas() {
  const { selectedPizzaria, selectedCampanha } = useOutletContext<DesempenhoContext>();

  // Period
  const [quickPeriod, setQuickPeriod] = useState("30d");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [groupBy, setGroupBy] = useState<"hora" | "dia" | "dia_semana" | "semana" | "mes">("dia");

  // Advanced filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tipoOperator, setTipoOperator] = useState("eq");
  const [tipoValues, setTipoValues] = useState<string[]>([]);
  const [canalOperator, setCanalOperator] = useState("eq");
  const [canalValues, setCanalValues] = useState<string[]>([]);
  const [valorOperator, setValorOperator] = useState("gt");
  const [valorNum, setValorNum] = useState("");
  const [valorNum2, setValorNum2] = useState("");
  const [horarioOperator, setHorarioOperator] = useState("gte");
  const [horarioValue, setHorarioValue] = useState("");

  // Data
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPedidos = async () => {
      setLoading(true);
      let query = supabase.from("pedidos").select("*");
      if (selectedPizzaria !== "todas") query = query.eq("pizzaria_id", selectedPizzaria);
      if (selectedCampanha !== "todas") query = query.eq("campanha_id", selectedCampanha);
      const { data } = await query.order("data_pedido", { ascending: false }).limit(5000);
      setPedidos((data as Pedido[]) || []);
      setLoading(false);
    };
    fetchPedidos();
  }, [selectedPizzaria, selectedCampanha]);

  // Compute date range from quick period
  const periodRange = useMemo(() => {
    if (dateRange.from && dateRange.to) return { from: dateRange.from, to: dateRange.to };
    const now = new Date();
    const today = startOfDay(now);
    switch (quickPeriod) {
      case "hoje": return { from: today, to: endOfDay(now) };
      case "ontem": return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
      case "esta_semana": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
      case "semana_passada": {
        const s = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        return { from: s, to: endOfWeek(s, { weekStartsOn: 1 }) };
      }
      case "este_mes": return { from: startOfMonth(now), to: endOfDay(now) };
      case "mes_passado": return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
      case "mes_1": return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
      case "mes_2": return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(subMonths(now, 2)) };
      case "mes_3": return { from: startOfMonth(subMonths(now, 3)), to: endOfMonth(subMonths(now, 3)) };
      case "2m": return { from: startOfDay(subMonths(now, 2)), to: endOfDay(now) };
      case "3m": return { from: startOfDay(subMonths(now, 3)), to: endOfDay(now) };
      case "6m": return { from: startOfDay(subMonths(now, 6)), to: endOfDay(now) };
      default: return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    }
  }, [quickPeriod, dateRange]);

  // Filtered pedidos
  const filteredPedidos = useMemo(() => {
    let list = pedidos.filter((p) => {
      const d = new Date(p.data_pedido);
      return d >= periodRange.from && d <= periodRange.to;
    });

    if (tipoValues.length > 0) {
      list = list.filter((p) => {
        const match = p.tipo_pedido ? tipoValues.includes(p.tipo_pedido) : false;
        return tipoOperator === "eq" ? match : !match;
      });
    }
    if (canalValues.length > 0) {
      list = list.filter((p) => {
        const match = canalValues.includes(p.canal);
        return canalOperator === "eq" ? match : !match;
      });
    }
    if (valorNum) {
      const v1 = parseFloat(valorNum);
      const v2 = valorNum2 ? parseFloat(valorNum2) : 0;
      list = list.filter((p) => {
        switch (valorOperator) {
          case "eq": return p.valor_total === v1;
          case "gt": return p.valor_total > v1;
          case "lt": return p.valor_total < v1;
          case "between": return p.valor_total >= v1 && p.valor_total <= v2;
          default: return true;
        }
      });
    }
    if (horarioValue) {
      const [hh, mm] = horarioValue.split(":").map(Number);
      const targetMinutes = hh * 60 + mm;
      list = list.filter((p) => {
        const dt = new Date(p.horario_pedido || p.data_pedido);
        const pedMinutes = dt.getHours() * 60 + dt.getMinutes();
        switch (horarioOperator) {
          case "gte": return pedMinutes >= targetMinutes;
          case "lte": return pedMinutes <= targetMinutes;
          case "gt": return pedMinutes > targetMinutes;
          case "lt": return pedMinutes < targetMinutes;
          case "eq": return pedMinutes === targetMinutes;
          default: return true;
        }
      });
    }
    return list;
  }, [pedidos, periodRange, tipoValues, tipoOperator, canalValues, canalOperator, valorNum, valorNum2, valorOperator, horarioValue, horarioOperator]);

  // KPIs
  const totalFaturamento = filteredPedidos.reduce((s, p) => s + p.valor_total, 0);
  const totalPedidos = filteredPedidos.length;
  const ticketMedio = totalPedidos > 0 ? totalFaturamento / totalPedidos : 0;
  const totalTaxaEntrega = filteredPedidos.reduce((s, p) => s + (p.taxa_entrega || 0), 0);
  const totalDescontos = filteredPedidos.reduce((s, p) => s + (p.desconto || 0), 0);
  const taxaPP = totalFaturamento * 0.15;

  // Chart data by groupBy
  const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const chartData = useMemo(() => {
    if (filteredPedidos.length === 0) return [];
    const map: Record<string, { label: string; faturamento: number; pedidos: number }> = {};

    filteredPedidos.forEach((p) => {
      const d = new Date(p.data_pedido);
      let key: string;
      let label: string;
      switch (groupBy) {
        case "hora":
          key = `${d.getHours()}`;
          label = `${d.getHours()}h`;
          break;
        case "dia":
          key = format(d, "yyyy-MM-dd");
          label = format(d, "dd/MM", { locale: ptBR });
          break;
        case "dia_semana":
          key = `${getDay(d)}`;
          label = DAY_NAMES[getDay(d)];
          break;
        case "semana":
          key = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
          label = `Sem ${format(d, "dd/MM", { locale: ptBR })}`;
          break;
        case "mes":
          key = format(d, "yyyy-MM");
          label = format(d, "MMM/yy", { locale: ptBR });
          break;
        default:
          key = format(d, "yyyy-MM-dd");
          label = format(d, "dd/MM");
      }
      if (!map[key]) map[key] = { label, faturamento: 0, pedidos: 0 };
      map[key].faturamento += p.valor_total;
      map[key].pedidos += 1;
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [filteredPedidos, groupBy]);

  // Payment analysis
  const paymentData = useMemo(() => {
    const map: Record<string, { qty: number; total: number }> = {};
    FORMAS_PAGAMENTO.forEach((f) => (map[f] = { qty: 0, total: 0 }));
    filteredPedidos.forEach((p) => {
      const key = p.forma_pagamento || "outros";
      if (!map[key]) map[key] = { qty: 0, total: 0 };
      map[key].qty += 1;
      map[key].total += p.valor_total;
    });
    const total = filteredPedidos.reduce((s, p) => s + p.valor_total, 0);
    return FORMAS_PAGAMENTO.map((f) => ({
      name: FORMAS_LABELS[f] || f,
      key: f,
      qty: map[f].qty,
      total: map[f].total,
      pct: total > 0 ? (map[f].total / total) * 100 : 0,
      ticket: map[f].qty > 0 ? map[f].total / map[f].qty : 0,
    })).filter((d) => d.qty > 0);
  }, [filteredPedidos]);

  // Neighborhood analysis
  const bairroData = useMemo(() => {
    const map: Record<string, { faturamento: number; qty: number }> = {};
    filteredPedidos.forEach((p) => {
      const b = p.bairro_entrega || "Não informado";
      if (!map[b]) map[b] = { faturamento: 0, qty: 0 };
      map[b].faturamento += p.valor_total;
      map[b].qty += 1;
    });
    return Object.entries(map)
      .map(([bairro, d]) => ({
        bairro,
        faturamento: d.faturamento,
        qty: d.qty,
        ticket: d.qty > 0 ? d.faturamento / d.qty : 0,
        taxaPP: d.faturamento * 0.15,
      }))
      .sort((a, b) => b.faturamento - a.faturamento);
  }, [filteredPedidos]);

  const clearFilters = () => {
    setTipoValues([]); setCanalValues([]); setValorNum(""); setValorNum2(""); setHorarioValue("");
    setDateRange({});
    setQuickPeriod("30d");
  };

  const now = new Date();
  const periodButtons = [
    { label: "Hoje", value: "hoje" },
    { label: "Ontem", value: "ontem" },
    { label: "Esta semana", value: "esta_semana" },
    { label: "Semana passada", value: "semana_passada" },
    { label: "Este mês", value: "este_mes" },
    { label: "Mês passado", value: "mes_passado" },
    { label: format(subMonths(now, 1), "MMMM yyyy", { locale: ptBR }), value: "mes_1" },
    { label: format(subMonths(now, 2), "MMMM yyyy", { locale: ptBR }), value: "mes_2" },
    { label: format(subMonths(now, 3), "MMMM yyyy", { locale: ptBR }), value: "mes_3" },
    { label: "Últimos 2 meses", value: "2m" },
    { label: "Últimos 3 meses", value: "3m" },
    { label: "Últimos 6 meses", value: "6m" },
  ];

  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      {/* Container 1 — Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {periodButtons.map((b) => (
              <Button
                key={b.value}
                size="sm"
                variant={quickPeriod === b.value && !dateRange.from ? "default" : "outline"}
                onClick={() => { setQuickPeriod(b.value); setDateRange({}); }}
                className="text-xs capitalize"
              >
                {b.label}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {dateRange.from
                    ? `${format(dateRange.from, "dd/MM")} - ${dateRange.to ? format(dateRange.to, "dd/MM") : "..."}`
                    : "Personalizado"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange as any}
                  onSelect={(range: any) => setDateRange(range || {})}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                <Filter className="mr-1 h-3 w-3" />
                {showAdvanced ? "Ocultar" : "+"} Filtros avançados
                <ChevronDown className={cn("ml-1 h-3 w-3 transition-transform", showAdvanced && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Tipo pedido */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Tipo de pedido</label>
                  <Select value={tipoOperator} onValueChange={setTipoOperator}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eq">É igual a</SelectItem>
                      <SelectItem value="neq">Não é igual a</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex flex-col gap-1">
                    {[{ v: "delivery", l: "Delivery" }, { v: "retirada", l: "Retirada" }, { v: "local", l: "No local" }].map((t) => (
                      <label key={t.v} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={tipoValues.includes(t.v)}
                          onCheckedChange={() => setTipoValues(toggleArray(tipoValues, t.v))}
                        />
                        {t.l}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Canal */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Canal de venda</label>
                  <Select value={canalOperator} onValueChange={setCanalOperator}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eq">É igual a</SelectItem>
                      <SelectItem value="neq">Não é igual a</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex flex-col gap-1">
                    {["CardápioWeb", "Balcão", "WhatsApp", "iFood", "Telefone"].map((c) => (
                      <label key={c} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={canalValues.includes(c)}
                          onCheckedChange={() => setCanalValues(toggleArray(canalValues, c))}
                        />
                        {c}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Valor */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Valor do pedido</label>
                  <Select value={valorOperator} onValueChange={setValorOperator}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eq">É igual a</SelectItem>
                      <SelectItem value="gt">Maior que</SelectItem>
                      <SelectItem value="lt">Menor que</SelectItem>
                      <SelectItem value="between">Entre</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="R$" value={valorNum} onChange={(e) => setValorNum(e.target.value)} className="h-8 text-xs" />
                    {valorOperator === "between" && (
                      <Input type="number" placeholder="R$" value={valorNum2} onChange={(e) => setValorNum2(e.target.value)} className="h-8 text-xs" />
                    )}
                  </div>
                </div>

                {/* Horário */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Horário do pedido</label>
                  <Select value={horarioOperator} onValueChange={setHorarioOperator}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gte">Posterior ou igual a</SelectItem>
                      <SelectItem value="lte">Anterior ou igual a</SelectItem>
                      <SelectItem value="gt">Posterior a</SelectItem>
                      <SelectItem value="lt">Anterior a</SelectItem>
                      <SelectItem value="eq">É igual a</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="time" value={horarioValue} onChange={(e) => setHorarioValue(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Exibindo <strong>{filteredPedidos.length}</strong> pedidos com os filtros aplicados
            </span>
            <div className="flex gap-2">
              <ExportButton
                data={filteredPedidos.map(p => ({
                  data: format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm"),
                  valor: p.valor_total, tipo: p.tipo_pedido || "—", canal: p.canal,
                  formaPagamento: p.forma_pagamento || "—", status: p.status,
                  bairro: p.bairro_entrega || "—", taxaEntrega: p.taxa_entrega, desconto: p.desconto,
                }))}
                columns={[
                  { key: "data", label: "Data" }, { key: "valor", label: "Valor" },
                  { key: "tipo", label: "Tipo" }, { key: "canal", label: "Canal" },
                  { key: "formaPagamento", label: "Forma Pagamento" }, { key: "status", label: "Status" },
                  { key: "bairro", label: "Bairro" }, { key: "taxaEntrega", label: "Taxa Entrega" },
                  { key: "desconto", label: "Desconto" },
                ]}
                fileName="desempenho-vendas"
                chartData={[
                  {
                    data: paymentData.map(d => ({ forma: d.name, qtd: d.qty, total: d.total, pct: `${d.pct.toFixed(1)}%`, ticket: d.ticket })),
                    columns: [
                      { key: "forma", label: "Forma" }, { key: "qtd", label: "Qtd" },
                      { key: "total", label: "Total" }, { key: "pct", label: "%" }, { key: "ticket", label: "Ticket Médio" },
                    ],
                    sheetName: "Formas de Pagamento",
                  },
                  {
                    data: bairroData.map((d, i) => ({ pos: i + 1, bairro: d.bairro, faturamento: d.faturamento, pedidos: d.qty, ticket: d.ticket, taxaPP: d.taxaPP })),
                    columns: [
                      { key: "pos", label: "#" }, { key: "bairro", label: "Bairro" },
                      { key: "faturamento", label: "Faturamento" }, { key: "pedidos", label: "Pedidos" },
                      { key: "ticket", label: "Ticket Médio" }, { key: "taxaPP", label: "Taxa PP" },
                    ],
                    sheetName: "Ranking Bairros",
                  },
                ]}
              />
              <Button size="sm" variant="outline" onClick={clearFilters} className="text-xs">Limpar filtros</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Container 2 — Chart */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">Total de faturamento</p>
              <p className="text-2xl font-bold text-primary">{fmtBRL(totalFaturamento)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">Quantidade de pedidos</p>
              <p className="text-2xl font-bold">{totalPedidos}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">Ticket médio</p>
              <p className="text-2xl font-bold">{fmtBRL(ticketMedio)}</p>
            </CardContent></Card>
          </div>

          <div className="flex justify-end gap-1">
            {(["hora", "dia", "dia_semana", "semana", "mes"] as const).map((g) => (
              <Button key={g} size="sm" variant={groupBy === g ? "default" : "outline"} onClick={() => setGroupBy(g)} className="text-xs capitalize">
                {g === "dia_semana" ? "Dia da semana" : g.charAt(0).toUpperCase() + g.slice(1)}
              </Button>
            ))}
          </div>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => [name === "faturamento" ? fmtBRL(v) : v, name === "faturamento" ? "Faturamento" : "Pedidos"]} />
                <Line yAxisId="left" type="monotone" dataKey="faturamento" stroke="#f97316" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="pedidos" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Container 3 — Detalhes */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Total de faturamento</p>
          <p className="text-xl font-bold">{fmtBRL(totalFaturamento)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Total taxa de entrega</p>
          <p className="text-xl font-bold">{fmtBRL(totalTaxaEntrega)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Total de descontos</p>
          <p className="text-xl font-bold">{fmtBRL(totalDescontos)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Taxa Pizza Premiada (15%)</p>
          <p className="text-xl font-bold text-primary">{fmtBRL(taxaPP)}</p>
        </CardContent></Card>
      </div>

      {/* Container 4 — Forma de pagamento */}
      <Card>
        <CardHeader><CardTitle className="text-base">Análise por forma de pagamento</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentData}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, pct }: any) => `${name}: ${pct.toFixed(1)}%`}
                    labelLine={false}
                  >
                    {paymentData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Forma</TableHead>
                  <TableHead className="text-xs text-right">Qtd</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs text-right">%</TableHead>
                  <TableHead className="text-xs text-right">Ticket médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentData.map((d) => (
                  <TableRow key={d.key}>
                    <TableCell className="text-xs">{d.name}</TableCell>
                    <TableCell className="text-xs text-right">{d.qty}</TableCell>
                    <TableCell className="text-xs text-right">{fmtBRL(d.total)}</TableCell>
                    <TableCell className="text-xs text-right">{d.pct.toFixed(1)}%</TableCell>
                    <TableCell className="text-xs text-right">{fmtBRL(d.ticket)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Container 5 — Bairro */}
      <Card>
        <CardHeader><CardTitle className="text-base">Análise por bairro</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-12">#</TableHead>
                <TableHead className="text-xs">Bairro</TableHead>
                <TableHead className="text-xs text-right">Faturamento</TableHead>
                <TableHead className="text-xs text-right">Pedidos</TableHead>
                <TableHead className="text-xs text-right">Ticket médio</TableHead>
                <TableHead className="text-xs text-right">Taxa PP (15%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bairroData.map((d, i) => (
                <TableRow key={d.bairro}>
                  <TableCell className="text-xs font-medium">{i + 1}</TableCell>
                  <TableCell className="text-xs">{d.bairro}</TableCell>
                  <TableCell className="text-xs text-right">{fmtBRL(d.faturamento)}</TableCell>
                  <TableCell className="text-xs text-right">{d.qty}</TableCell>
                  <TableCell className="text-xs text-right">{fmtBRL(d.ticket)}</TableCell>
                  <TableCell className="text-xs text-right">{fmtBRL(d.taxaPP)}</TableCell>
                </TableRow>
              ))}
              {bairroData.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">Nenhum dado disponível</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

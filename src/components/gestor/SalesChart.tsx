import { useState, useMemo } from "react";
import {
  startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths,
  format, differenceInDays, startOfWeek, eachWeekOfInterval, eachMonthOfInterval,
  isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, Check, BarChart2, Clock, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

export type QuickPeriod = "campanha" | "hoje" | "7dias" | "30dias" | "este_mes" | "mes_anterior" | "ciclo" | "custom";
export type Metrica = "faturamento" | "pedidos" | "cupons";

export interface PedidoChart {
  id: string;
  data: Date;
  canal: string;
  valor: number;
  pizzaria_id: string;
  status: string;
}

export interface CupomChart {
  pedido_id: string | null;
  quantidade: number;
}

export interface PizzariaInfo {
  id: string;
  nome: string;
  cidade: string;
  bairro: string;
}

const QUICK_LABELS: Record<Exclude<QuickPeriod, "custom">, string> = {
  campanha: "Toda a campanha",
  hoje: "Hoje",
  "7dias": "Últ. 7 dias",
  "30dias": "Últ. 30 dias",
  este_mes: "Este mês",
  mes_anterior: "Mês anterior",
  ciclo: "Este ciclo",
};

const METRICA_LABELS: Record<Metrica, string> = {
  faturamento: "Faturamento (R$)",
  pedidos: "Pedidos",
  cupons: "Cupons",
};

function getQuickRange(p: Exclude<QuickPeriod, "custom" | "campanha">): [Date, Date] {
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
    case "ciclo": return [subMonths(startOfMonth(today), 3), endOfDay(today)];
  }
}

interface Props {
  pedidos: PedidoChart[];
  cupons: CupomChart[];
  pizzariasList: PizzariaInfo[];
  quick: QuickPeriod;
  dateFrom: Date;
  dateTo: Date;
  metrica: Metrica;
  selectedPizzariaIds: string[] | null;
  selectedCanais: string[] | null;
  onQuickChange: (q: QuickPeriod, from: Date, to: Date) => void;
  onMetricaChange: (m: Metrica) => void;
  onPizzariasChange: (ids: string[] | null) => void;
  onCanaisChange: (canais: string[] | null) => void;
}

export default function SalesChart({
  pedidos, cupons, pizzariasList,
  quick, dateFrom, dateTo, metrica, selectedPizzariaIds, selectedCanais,
  onQuickChange, onMetricaChange, onPizzariasChange, onCanaisChange,
}: Props) {
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [expandedCidades, setExpandedCidades] = useState<Set<string>>(new Set());

  const canaisDisponiveis = useMemo(() => [...new Set(pedidos.map(p => p.canal))].sort(), [pedidos]);

  const allPizzariaIds = useMemo(() => pizzariasList.map(p => p.id), [pizzariasList]);
  const isAllSelected = selectedPizzariaIds === null || selectedPizzariaIds.length === allPizzariaIds.length;

  // Hierarchy: cidade → bairro → pizzarias
  const hierarchy = useMemo(() => {
    const cidadeMap = new Map<string, Map<string, PizzariaInfo[]>>();
    pizzariasList.forEach(p => {
      if (!cidadeMap.has(p.cidade)) cidadeMap.set(p.cidade, new Map());
      const bm = cidadeMap.get(p.cidade)!;
      const bairro = p.bairro || "Sem bairro";
      if (!bm.has(bairro)) bm.set(bairro, []);
      bm.get(bairro)!.push(p);
    });
    return [...cidadeMap.entries()]
      .map(([cidade, bm]) => ({
        cidade,
        allIds: [...bm.values()].flat().map(p => p.id),
        bairros: [...bm.entries()]
          .map(([bairro, pzs]) => ({ bairro, ids: pzs.map(p => p.id), pizzarias: pzs }))
          .sort((a, b) => a.bairro.localeCompare(b.bairro)),
      }))
      .sort((a, b) => a.cidade.localeCompare(b.cidade));
  }, [pizzariasList]);

  const getGroupState = (ids: string[]): boolean | "indeterminate" => {
    if (selectedPizzariaIds === null) return true;
    const n = ids.filter(id => selectedPizzariaIds.includes(id)).length;
    if (n === ids.length) return true;
    if (n === 0) return false;
    return "indeterminate";
  };

  const isPizzariaSelected = (id: string) =>
    selectedPizzariaIds === null || selectedPizzariaIds.includes(id);

  const toggleGroup = (ids: string[]) => {
    const state = getGroupState(ids);
    const current = selectedPizzariaIds ?? allPizzariaIds;
    const next = state === true
      ? current.filter(id => !ids.includes(id))
      : [...new Set([...current, ...ids])];
    onPizzariasChange(next.length === allPizzariaIds.length ? null : next.length === 0 ? [] : next);
  };

  const togglePizzaria = (id: string) => {
    if (selectedPizzariaIds === null) {
      onPizzariasChange(allPizzariaIds.filter(i => i !== id));
    } else if (selectedPizzariaIds.includes(id)) {
      const next = selectedPizzariaIds.filter(i => i !== id);
      onPizzariasChange(next.length === 0 ? [] : next);
    } else {
      const next = [...selectedPizzariaIds, id];
      onPizzariasChange(next.length === allPizzariaIds.length ? null : next);
    }
  };

  const toggleCanal = (canal: string, checked: boolean) => {
    const current = selectedCanais ?? canaisDisponiveis;
    const next = checked ? [...new Set([...current, canal])] : current.filter(c => c !== canal);
    onCanaisChange(next.length === canaisDisponiveis.length ? null : next.length === 0 ? [] : next);
  };

  // Effective date range for chart (when "campanha": derive from data)
  const { effectiveFrom, effectiveTo } = useMemo(() => {
    if (quick !== "campanha" && quick !== "custom" as QuickPeriod) {
      return { effectiveFrom: dateFrom, effectiveTo: dateTo };
    }
    if (quick === "campanha" && pedidos.length > 0) {
      const times = pedidos.map(p => p.data.getTime());
      return {
        effectiveFrom: startOfDay(new Date(Math.min(...times))),
        effectiveTo: endOfDay(new Date()),
      };
    }
    return { effectiveFrom: dateFrom, effectiveTo: dateTo };
  }, [quick, dateFrom, dateTo, pedidos]);

  // Pedido map for cupons lookup
  const pedidoMap = useMemo(() => {
    const m = new Map<string, PedidoChart>();
    pedidos.forEach(p => m.set(p.id, p));
    return m;
  }, [pedidos]);

  const isInFilter = (p: PedidoChart): boolean => {
    if (p.status === "cancelado") return false;
    if (quick !== "campanha") {
      try {
        if (!isWithinInterval(p.data, { start: effectiveFrom, end: effectiveTo })) return false;
      } catch { return false; }
    }
    if (selectedPizzariaIds && selectedPizzariaIds.length > 0 && !selectedPizzariaIds.includes(p.pizzaria_id)) return false;
    if (selectedCanais && selectedCanais.length > 0 && !selectedCanais.includes(p.canal)) return false;
    return true;
  };

  const chartData = useMemo(() => {
    const from = effectiveFrom;
    const to = effectiveTo;
    const days = Math.max(differenceInDays(to, from) + 1, 1);
    const grp: "day" | "week" | "month" = days > 90 ? "month" : days > 31 ? "week" : "day";

    const getKey = (d: Date) => {
      if (grp === "day") return format(d, "yyyy-MM-dd");
      if (grp === "week") return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
      return format(d, "yyyy-MM");
    };

    const map = new Map<string, number>();

    if (metrica === "cupons") {
      cupons.forEach(c => {
        if (!c.pedido_id) return;
        const p = pedidoMap.get(c.pedido_id);
        if (!p || !isInFilter(p)) return;
        const key = getKey(p.data);
        map.set(key, (map.get(key) || 0) + c.quantidade);
      });
    } else {
      pedidos.filter(isInFilter).forEach(p => {
        const key = getKey(p.data);
        map.set(key, (map.get(key) || 0) + (metrica === "faturamento" ? p.valor : 1));
      });
    }

    const interval = { start: from, end: to };
    if (grp === "day") {
      const result: { label: string; valor: number }[] = [];
      for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400000))
        result.push({ label: format(d, "dd/MM"), valor: map.get(format(d, "yyyy-MM-dd")) || 0 });
      return result;
    }
    if (grp === "week") {
      return eachWeekOfInterval(interval, { weekStartsOn: 1 }).map(w => ({
        label: `Sem ${format(w, "dd/MM")}`,
        valor: map.get(format(w, "yyyy-MM-dd")) || 0,
      }));
    }
    return eachMonthOfInterval(interval).map(m => ({
      label: format(m, "MMM yyyy", { locale: ptBR }),
      valor: map.get(format(m, "yyyy-MM")) || 0,
    }));
  }, [pedidos, cupons, pedidoMap, quick, effectiveFrom, effectiveTo, metrica, selectedPizzariaIds, selectedCanais]);

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    onQuickChange("custom", startOfDay(new Date(customFrom)), endOfDay(new Date(customTo)));
  };

  const pizzariaLabel = isAllSelected
    ? "Todas"
    : !selectedPizzariaIds || selectedPizzariaIds.length === 0
    ? "Nenhuma"
    : selectedPizzariaIds.length === 1
    ? (pizzariasList.find(p => p.id === selectedPizzariaIds[0])?.nome ?? "1 pizzaria")
    : `${selectedPizzariaIds.length} pizzarias`;

  const periodoLabel = quick === "custom"
    ? `${format(dateFrom, "dd/MM")} – ${format(dateTo, "dd/MM")}`
    : QUICK_LABELS[quick as Exclude<QuickPeriod, "custom">];

  const hasActiveFilters = metrica !== "faturamento" || quick !== "campanha" || !isAllSelected
    || (selectedCanais !== null && selectedCanais.length < canaisDisponiveis.length);

  const chartConfig = { valor: { label: METRICA_LABELS[metrica], color: "hsl(25 95% 53%)" } };

  const yFormatter = metrica === "faturamento"
    ? (v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
    : undefined;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-heading">📈 Gráfico de Vendas</CardTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="text-xs h-6 text-muted-foreground" onClick={() => {
              onMetricaChange("faturamento");
              onQuickChange("campanha", startOfMonth(new Date()), endOfDay(new Date()));
              onPizzariasChange(null);
              onCanaisChange(null);
            }}>
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Filtros colapsáveis */}
        <div className="flex flex-wrap items-center gap-2">

          {/* 1 — Métrica */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={metrica !== "faturamento" ? "default" : "outline"}
                size="sm" className="text-xs h-7 gap-1.5"
              >
                <BarChart2 className="h-3 w-3" />
                {METRICA_LABELS[metrica]}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="start">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Métrica</p>
              <div className="space-y-0.5">
                {(["faturamento", "pedidos", "cupons"] as Metrica[]).map(m => (
                  <button
                    key={m}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors",
                      metrica === m && "bg-primary/10 text-primary font-medium"
                    )}
                    onClick={() => onMetricaChange(m)}
                  >
                    <span className="w-3.5 shrink-0 flex items-center justify-center">
                      {metrica === m && <Check className="h-3 w-3" />}
                    </span>
                    {METRICA_LABELS[m]}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* 2 — Período */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={quick !== "campanha" ? "default" : "outline"}
                size="sm" className="text-xs h-7 gap-1.5"
              >
                <Clock className="h-3 w-3" />
                {periodoLabel}
                {selectedCanais !== null && selectedCanais.length < canaisDisponiveis.length
                  ? ` · ${selectedCanais.length} canal` : ""}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Período</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(Object.keys(QUICK_LABELS) as Exclude<QuickPeriod, "custom">[]).map(p => (
                  <Button
                    key={p}
                    variant={quick === p ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-6 px-2 shrink-0"
                    onClick={() => {
                      if (p === "campanha") {
                        onQuickChange("campanha", startOfMonth(new Date()), endOfDay(new Date()));
                      } else {
                        const [from, to] = getQuickRange(p as Exclude<QuickPeriod, "custom" | "campanha">);
                        onQuickChange(p, from, to);
                      }
                    }}
                  >
                    {QUICK_LABELS[p]}
                  </Button>
                ))}
              </div>

              <div className="h-px bg-border mb-2" />
              <p className="text-[11px] text-muted-foreground mb-1.5">Personalizado</p>
              <div className="flex items-center gap-1.5 mb-3">
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="flex-1 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground shrink-0">–</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="flex-1 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button size="sm" className="text-xs h-7 shrink-0 px-2" onClick={applyCustom} disabled={!customFrom || !customTo}>
                  OK
                </Button>
              </div>

              {canaisDisponiveis.length > 1 && (
                <>
                  <div className="h-px bg-border mb-2" />
                  <p className="text-[11px] text-muted-foreground mb-1.5">Canal</p>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={selectedCanais === null || selectedCanais.length === canaisDisponiveis.length}
                        onCheckedChange={v => onCanaisChange(v ? null : [])}
                      />
                      Todos os canais
                    </label>
                    {canaisDisponiveis.map(c => (
                      <label key={c} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={selectedCanais === null || selectedCanais.includes(c)}
                          onCheckedChange={v => toggleCanal(c, !!v)}
                        />
                        {c}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </PopoverContent>
          </Popover>

          {/* 3 — Pizzaria */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={!isAllSelected ? "default" : "outline"}
                size="sm" className="text-xs h-7 gap-1.5"
              >
                <Store className="h-3 w-3" />
                {pizzariaLabel}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="end">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pizzaria</p>
              <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
                <label className="flex items-center gap-2 text-xs cursor-pointer font-medium py-1">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={v => onPizzariasChange(v ? null : [])}
                  />
                  Todas as pizzarias
                </label>
                <div className="h-px bg-border my-1" />
                {hierarchy.map(({ cidade, allIds: cidadeIds, bairros }) => (
                  <div key={cidade}>
                    <div className="flex items-center gap-1 py-0.5">
                      <button
                        className="w-4 h-4 flex items-center justify-center text-[10px] text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => setExpandedCidades(prev => {
                          const next = new Set(prev);
                          next.has(cidade) ? next.delete(cidade) : next.add(cidade);
                          return next;
                        })}
                      >
                        {expandedCidades.has(cidade) ? "▾" : "▸"}
                      </button>
                      <label className="flex items-center gap-2 text-xs cursor-pointer flex-1 font-medium">
                        <Checkbox
                          checked={getGroupState(cidadeIds)}
                          onCheckedChange={() => toggleGroup(cidadeIds)}
                        />
                        {cidade}
                        <span className="text-muted-foreground font-normal">({cidadeIds.length})</span>
                      </label>
                    </div>
                    {expandedCidades.has(cidade) && (
                      <div className="ml-5 border-l border-border/50 pl-2 space-y-0.5 pb-1">
                        {bairros.map(({ bairro, ids, pizzarias }) => (
                          <div key={bairro}>
                            {pizzarias.length > 1 && (
                              <label className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground py-0.5">
                                <Checkbox
                                  checked={getGroupState(ids)}
                                  onCheckedChange={() => toggleGroup(ids)}
                                />
                                {bairro}
                              </label>
                            )}
                            <div className={cn("space-y-0.5", pizzarias.length > 1 && "ml-5")}>
                              {pizzarias.map(pz => (
                                <label key={pz.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                                  <Checkbox
                                    checked={isPizzariaSelected(pz.id)}
                                    onCheckedChange={() => togglePizzaria(pz.id)}
                                  />
                                  {pz.nome}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>

      <CardContent>
        {chartData.every(d => d.valor === 0) ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
            Sem dados para os filtros selecionados.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="valor-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(25 95% 53%)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="hsl(25 95% 53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 8" stroke="hsl(var(--border))" strokeWidth={0.8} vertical={false} />
              <XAxis
                dataKey="label"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                interval="preserveStartEnd"
                axisLine={false}
                tickLine={false}
                dy={8}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                axisLine={false}
                tickLine={false}
                width={60}
                tickFormatter={yFormatter}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="valor"
                stroke="hsl(25 95% 53%)"
                strokeWidth={2}
                fill="url(#valor-fill)"
                dot={false}
                activeDot={{ r: 4, fill: "hsl(25 95% 53%)", strokeWidth: 0 }}
                animationDuration={3000}
                animationEasing="ease-in-out"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

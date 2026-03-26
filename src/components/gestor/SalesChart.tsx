import { useState, useMemo } from "react";
import {
  startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths,
  format, differenceInDays, startOfWeek, eachWeekOfInterval, eachMonthOfInterval,
  isWithinInterval, isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { vendasDiarias, CANAIS_VENDA, type CanalVenda } from "@/data/dashboardMockData";
import { cn } from "@/lib/utils";

type QuickPeriod = "hoje" | "7dias" | "30dias" | "este_mes" | "mes_anterior" | "ciclo";

const QUICK_LABELS: Record<QuickPeriod, string> = {
  hoje: "Hoje",
  "7dias": "Últimos 7 dias",
  "30dias": "Últimos 30 dias",
  este_mes: "Este mês",
  mes_anterior: "Mês anterior",
  ciclo: "Este ciclo (4 meses)",
};

function getQuickRange(p: QuickPeriod): [Date, Date] {
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

function buildTitle(from: Date, to: Date): string {
  if (isSameDay(from, to)) return `Vendas — ${format(from, "dd/MM/yyyy")}`;
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  if (sameMonth && from.getDate() === 1 && to.getDate() >= 28)
    return `Vendas — ${format(from, "MMMM yyyy", { locale: ptBR })}`;
  return `Vendas — ${format(from, "dd/MM")} até ${format(to, "dd/MM")}`;
}

export default function SalesChart() {
  const [quick, setQuick] = useState<QuickPeriod | null>("este_mes");
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfDay(new Date()));
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);

  const [selectedCanais, setSelectedCanais] = useState<CanalVenda[]>([...CANAIS_VENDA]);
  const allSelected = selectedCanais.length === CANAIS_VENDA.length;

  const selectQuick = (p: QuickPeriod) => {
    setQuick(p);
    const [f, t] = getQuickRange(p);
    setDateFrom(f);
    setDateTo(t);
    setCustomFrom(f);
    setCustomTo(t);
  };

  const applyCustom = () => {
    if (customFrom && customTo) {
      setQuick(null);
      setDateFrom(startOfDay(customFrom));
      setDateTo(endOfDay(customTo));
    }
  };

  const toggleCanal = (c: CanalVenda) =>
    setSelectedCanais((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  const toggleAll = () => setSelectedCanais(allSelected ? [] : [...CANAIS_VENDA]);

  const days = differenceInDays(dateTo, dateFrom) + 1;
  const grouping: "day" | "week" | "month" = days > 90 ? "month" : days > 31 ? "week" : "day";

  const chartData = useMemo(() => {
    const interval = { start: startOfDay(dateFrom), end: endOfDay(dateTo) };
    const filtered = vendasDiarias.filter(
      (r) => selectedCanais.includes(r.canal) && isWithinInterval(r.data, interval)
    );

    if (grouping === "day") {
      const map = new Map<string, number>();
      for (const r of filtered) {
        const key = format(r.data, "yyyy-MM-dd");
        map.set(key, (map.get(key) || 0) + r.vendas);
      }
      const result: { label: string; vendas: number }[] = [];
      for (let d = new Date(dateFrom); d <= dateTo; d = new Date(d.getTime() + 86400000)) {
        const key = format(d, "yyyy-MM-dd");
        result.push({ label: format(d, "dd/MM"), vendas: map.get(key) || 0 });
      }
      return result;
    }

    if (grouping === "week") {
      const weeks = eachWeekOfInterval(interval, { weekStartsOn: 1 });
      const map = new Map<string, number>();
      for (const r of filtered) {
        const wk = format(startOfWeek(r.data, { weekStartsOn: 1 }), "yyyy-MM-dd");
        map.set(wk, (map.get(wk) || 0) + r.vendas);
      }
      return weeks.map((w) => ({
        label: `Sem ${format(w, "dd/MM")}`,
        vendas: map.get(format(w, "yyyy-MM-dd")) || 0,
      }));
    }

    // month
    const months = eachMonthOfInterval(interval);
    const map = new Map<string, number>();
    for (const r of filtered) {
      const mk = format(r.data, "yyyy-MM");
      map.set(mk, (map.get(mk) || 0) + r.vendas);
    }
    return months.map((m) => ({
      label: format(m, "MMM", { locale: ptBR }),
      vendas: map.get(format(m, "yyyy-MM")) || 0,
    }));
  }, [dateFrom, dateTo, selectedCanais, grouping]);

  const chartConfig = { vendas: { label: "Vendas", color: "hsl(25 95% 53%)" } };
  const title = buildTitle(dateFrom, dateTo);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-heading">📈 {title}</CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                {allSelected ? "Todos os canais" : `${selectedCanais.length} canal(is)`}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="end">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  Todos os canais
                </label>
                <div className="h-px bg-border my-1" />
                {CANAIS_VENDA.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={selectedCanais.includes(c)} onCheckedChange={() => toggleCanal(c)} />
                    {c}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Quick period buttons */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(QUICK_LABELS) as QuickPeriod[]).map((p) => (
            <Button
              key={p}
              variant={quick === p ? "default" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => selectQuick(p)}
            >
              {QUICK_LABELS[p]}
            </Button>
          ))}
        </div>

        {/* Custom date range */}
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("text-xs h-8 w-[140px] justify-start", !customFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-3 w-3" />
                {customFrom ? format(customFrom, "dd/MM/yyyy") : "Data inicial"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("text-xs h-8 w-[140px] justify-start", !customTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-3 w-3" />
                {customTo ? format(customTo, "dd/MM/yyyy") : "Data final"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Button size="sm" className="text-xs h-8" onClick={applyCustom} disabled={!customFrom || !customTo}>
            Aplicar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
            <XAxis dataKey="label" stroke="hsl(220 10% 55%)" fontSize={11} interval="preserveStartEnd" />
            <YAxis stroke="hsl(220 10% 55%)" fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="vendas" stroke="hsl(25 95% 53%)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "hsl(25 95% 53%)" }} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

import { useMemo, useState } from "react";
import { DollarSign, ShoppingBag, ArrowDownRight, Ticket, Trophy } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subDays, eachDayOfInterval, startOfDay, endOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

/* ── Mock data ── */
const today = new Date();
const VENDAS_MES = 18450;
const PEDIDOS_MES = 127;
const REPASSE = Math.round(VENDAS_MES * 0.85);
const CUPONS_CICLO = 312;

type QuickPeriod = "este_mes" | "mes_anterior" | "30dias";
function getRange(p: QuickPeriod): [Date, Date] {
  const t = startOfDay(today);
  switch (p) {
    case "este_mes": return [startOfMonth(t), endOfDay(t)];
    case "mes_anterior": { const prev = subMonths(t, 1); return [startOfMonth(prev), endOfDay(endOfMonth(prev))]; }
    case "30dias": return [subDays(t, 29), endOfDay(t)];
  }
}

const LABELS: Record<QuickPeriod, string> = { este_mes: "Este mês", mes_anterior: "Mês anterior", "30dias": "Últimos 30 dias" };

function generateOrders(from: Date, to: Date) {
  const days = eachDayOfInterval({ start: from, end: to });
  return days.map((d) => ({ label: format(d, "dd/MM"), pedidos: Math.floor(Math.random() * 8) + 1 }));
}

export default function PizzariaDashboard() {
  const [period, setPeriod] = useState<QuickPeriod>("este_mes");
  const [from, to] = getRange(period);
  const chartData = useMemo(() => generateOrders(from, to), [period]);

  const kpis = [
    { label: "Vendas do mês", value: `R$ ${VENDAS_MES.toLocaleString("pt-BR")}`, icon: DollarSign },
    { label: "Pedidos do mês", value: String(PEDIDOS_MES), icon: ShoppingBag },
    { label: "Repasse a receber (85%)", value: `R$ ${REPASSE.toLocaleString("pt-BR")}`, icon: ArrowDownRight },
    { label: "Cupons gerados no ciclo", value: String(CUPONS_CICLO), icon: Ticket },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">📊 Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral da sua pizzaria na campanha.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
              <k.icon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{k.value}</p></CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card className="border-border bg-card">
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Pedidos por dia</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(LABELS) as QuickPeriod[]).map((p) => (
              <Button key={p} variant={period === p ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setPeriod(p)}>
                {LABELS[p]}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ pedidos: { label: "Pedidos", color: "hsl(25 95% 53%)" } }} className="h-[250px] w-full">
            <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
              <XAxis dataKey="label" stroke="hsl(220 10% 55%)" fontSize={11} interval="preserveStartEnd" />
              <YAxis stroke="hsl(220 10% 55%)" fontSize={12} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="pedidos" fill="hsl(25 95% 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Campaign highlight */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="font-heading font-bold text-lg">Pizza Premiada — Ciclo 1</h3>
            <p className="text-sm text-muted-foreground">Período: 01/01/2026 até 30/04/2026 · <strong className="text-primary">36 dias restantes</strong></p>
            <div className="flex flex-wrap gap-3 text-sm">
              <span>🥇 1º: iPhone 15</span>
              <span>🥈 2º: Smart TV 55"</span>
              <span>🥉 3º: Vale-compras R$500</span>
            </div>
            <p className="text-xs text-muted-foreground italic mt-1">Seus clientes estão acumulando cupons. Continue participando!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

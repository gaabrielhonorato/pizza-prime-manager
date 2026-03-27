import { useMemo, useState } from "react";
import { DollarSign, ShoppingBag, ArrowDownRight, Ticket, Trophy } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subDays, eachDayOfInterval, startOfDay, endOfDay, isSameDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useMinhaPizzaria } from "@/contexts/MinhaPizzariaContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

type QuickPeriod = "este_mes" | "mes_anterior" | "30dias";
function getRange(p: QuickPeriod): [Date, Date] {
  const t = startOfDay(new Date());
  switch (p) {
    case "este_mes": return [startOfMonth(t), endOfDay(t)];
    case "mes_anterior": { const prev = subMonths(t, 1); return [startOfMonth(prev), endOfDay(endOfMonth(prev))]; }
    case "30dias": return [subDays(t, 29), endOfDay(t)];
  }
}

const LABELS: Record<QuickPeriod, string> = { este_mes: "Este mês", mes_anterior: "Mês anterior", "30dias": "Últimos 30 dias" };

export default function PizzariaDashboard() {
  const { pizzaria, stats, loading } = useMinhaPizzaria();
  const [period, setPeriod] = useState<QuickPeriod>("este_mes");
  const [chartData, setChartData] = useState<{ label: string; pedidos: number }[]>([]);

  const repasse = Math.round(stats.vendasMes * 0.85);

  useEffect(() => {
    if (!pizzaria) return;
    const [from, to] = getRange(period);

    async function fetchChart() {
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("data_pedido")
        .eq("pizzaria_id", pizzaria!.id)
        .gte("data_pedido", from.toISOString())
        .lte("data_pedido", to.toISOString());

      const days = eachDayOfInterval({ start: from, end: to });
      const mapped = days.map((d) => ({
        label: format(d, "dd/MM"),
        pedidos: pedidos?.filter((p) => isSameDay(new Date(p.data_pedido), d)).length ?? 0,
      }));
      setChartData(mapped);
    }
    fetchChart();
  }, [pizzaria, period]);

  const kpis = [
    { label: "Vendas do mês", value: `R$ ${stats.vendasMes.toLocaleString("pt-BR")}`, icon: DollarSign },
    { label: "Pedidos do mês", value: String(stats.pedidosMes), icon: ShoppingBag },
    { label: "Repasse a receber (85%)", value: `R$ ${repasse.toLocaleString("pt-BR")}`, icon: ArrowDownRight },
    { label: "Cupons gerados no ciclo", value: String(stats.cuponsCiclo), icon: Ticket },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  }

  if (!pizzaria) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Nenhuma pizzaria vinculada à sua conta. Entre em contato com o gestor.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">📊 Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral da sua pizzaria na campanha.</p>
      </div>

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

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="font-heading font-bold text-lg">{pizzaria.nome}</h3>
            <p className="text-sm text-muted-foreground">
              Status: <strong className="text-primary">{pizzaria.status}</strong> · 
              Meta mensal: <strong>R$ {pizzaria.metaMensal.toLocaleString("pt-BR")}</strong>
            </p>
            <p className="text-xs text-muted-foreground italic mt-1">
              Seus clientes estão acumulando cupons. Continue participando!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { DollarSign, ShoppingBag, ArrowDownRight, Ticket, TrendingUp, Download, BarChart2, List, FileSpreadsheet, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subDays, eachWeekOfInterval, endOfWeek, startOfDay, endOfDay, isSameWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { useMinhaPizzaria } from "@/contexts/MinhaPizzariaContext";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter } from "@/lib/pdf-helpers";

type QuickPeriod = "este_mes" | "mes_anterior" | "90dias" | "campanha";
type Metric = "faturamento" | "pedidos";

const PERIOD_LABELS: Record<QuickPeriod, string> = {
  este_mes: "Este mês",
  mes_anterior: "Mês anterior",
  "90dias": "Últimos 90 dias",
  campanha: "Toda a campanha",
};
const METRIC_LABELS: Record<Metric, string> = { faturamento: "Faturamento (R$)", pedidos: "Pedidos (qtd)" };

function getRange(p: QuickPeriod, dataEntrada?: string | null): [Date, Date] {
  const today = startOfDay(new Date());
  switch (p) {
    case "este_mes": return [startOfMonth(today), endOfDay(today)];
    case "mes_anterior": { const prev = subMonths(today, 1); return [startOfMonth(prev), endOfDay(endOfMonth(prev))]; }
    case "90dias": return [subDays(today, 89), endOfDay(today)];
    case "campanha": {
      const from = dataEntrada ? new Date(dataEntrada + "T00:00:00") : subDays(today, 180);
      return [from, endOfDay(today)];
    }
  }
}

const CANAL_LABELS: Record<string, string> = {
  cardapioweb: "CardápioWeb", whatsapp: "WhatsApp", balcao: "Balcão",
  anuncios: "Anúncios", indicacao: "Indicação", outros: "Outros",
};
const PAGAMENTO_LABELS: Record<string, string> = {
  pix: "Pix", cartao_debito: "Cartão Débito", cartao_credito: "Cartão Crédito",
  dinheiro: "Dinheiro", outros: "Outros",
};

const DONUT_COLORS = [
  "hsl(25 95% 53%)", "hsl(142 71% 45%)", "hsl(217 91% 60%)",
  "hsl(262 80% 60%)", "hsl(0 0% 60%)", "hsl(48 96% 53%)",
];

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtShort = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;
const fmtAxis = (v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`;

interface RawPedido {
  data_pedido: string;
  canal: string | null;
  valor_total: number | string;
  forma_pagamento: string | null;
}

export default function PizzariaDashboard() {
  const { pizzaria, stats, loading } = useMinhaPizzaria();
  const [period, setPeriod] = useState<QuickPeriod>("campanha");
  const [metric, setMetric] = useState<Metric>("faturamento");
  const [percentualPP, setPercentualPP] = useState(15);
  const [rawData, setRawData] = useState<RawPedido[]>([]);

  useEffect(() => {
    if (!pizzaria) return;
    supabase
      .from("repasses")
      .select("percentual_pizza_premiada")
      .eq("pizzaria_id", pizzaria.id)
      .order("periodo_inicio", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.percentual_pizza_premiada) setPercentualPP(Number(data.percentual_pizza_premiada));
      });
  }, [pizzaria]);

  useEffect(() => {
    if (!pizzaria) return;
    const [from, to] = getRange(period, pizzaria.dataEntrada);
    supabase
      .from("pedidos")
      .select("data_pedido, canal, valor_total, forma_pagamento")
      .eq("pizzaria_id", pizzaria.id)
      .gte("data_pedido", from.toISOString())
      .lte("data_pedido", to.toISOString())
      .then(({ data }) => setRawData((data ?? []) as RawPedido[]));
  }, [pizzaria, period]);

  const chartData = useMemo(() => {
    if (!rawData.length) return [];
    const [from, to] = getRange(period, pizzaria?.dataEntrada);
    const weeks = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
    return weeks.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekPedidos = rawData.filter((p) => {
        const d = new Date(p.data_pedido);
        return isSameWeek(d, weekStart, { weekStartsOn: 1 });
      });
      return {
        label: `Sem ${format(weekStart, "dd/MM")}`,
        faturamento: weekPedidos.reduce((s, p) => s + Number(p.valor_total), 0),
        pedidos: weekPedidos.length,
        weekEnd,
      };
    });
  }, [rawData, period, pizzaria]);

  const canalData = useMemo(() => {
    const map: Record<string, { count: number; valor: number }> = {};
    rawData.forEach((p) => {
      const c = p.canal || "outros";
      if (!map[c]) map[c] = { count: 0, valor: 0 };
      map[c].count++;
      map[c].valor += Number(p.valor_total);
    });
    return Object.entries(map)
      .map(([canal, v]) => ({ canal, label: CANAL_LABELS[canal] ?? canal, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [rawData]);

  const pagamentoData = useMemo(() => {
    const map: Record<string, number> = {};
    rawData.forEach((p) => {
      const pg = p.forma_pagamento || "outros";
      map[pg] = (map[pg] ?? 0) + 1;
    });
    return Object.entries(map)
      .map(([key, count]) => ({ key, label: PAGAMENTO_LABELS[key] ?? key, count }))
      .sort((a, b) => b.count - a.count);
  }, [rawData]);

  const totalCanalPedidos = canalData.reduce((s, c) => s + c.count, 0);
  const totalPagPedidos = pagamentoData.reduce((s, p) => s + p.count, 0);
  const pizzariaShare = 100 - percentualPP;
  const repasse = Math.round(stats.vendasMes * pizzariaShare / 100);
  const ticketMedio = stats.pedidosMes > 0 ? Math.round(stats.vendasMes / stats.pedidosMes) : 0;

  const kpis = useMemo(() => [
    { label: "Vendas do mês", value: fmtShort(stats.vendasMes), icon: DollarSign, color: "text-primary" },
    { label: "Pedidos do mês", value: String(stats.pedidosMes), icon: ShoppingBag, color: "text-blue-400" },
    { label: "Ticket médio", value: fmtShort(ticketMedio), icon: TrendingUp, color: "text-emerald-400" },
    { label: `Repasse est. (${pizzariaShare}%)`, value: fmtShort(repasse), icon: ArrowDownRight, color: "text-amber-400" },
    { label: "Cupons no ciclo", value: String(stats.cuponsCiclo), icon: Ticket, color: "text-purple-400" },
  ], [stats, repasse, pizzariaShare, ticketMedio]);

  async function exportSinteticoPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const lettering = await loadLetteringDataUrl();
    let y = buildPdfHeader(doc, "Dashboard — Relatório Sintético", pizzaria?.nome ?? "", [`Período: ${PERIOD_LABELS[period]}`], lettering);
    const boxW = 36; const boxH = 22; const gap = 3; const startX = 20;
    kpis.forEach((k, i) => {
      const bx = startX + i * (boxW + gap);
      doc.setFillColor(...C.slate50); doc.setDrawColor(...C.slate200); doc.setLineWidth(0.4);
      doc.rect(bx, y, boxW, boxH, "FD");
      doc.setFontSize(5.5); doc.setTextColor(...C.slate500); doc.setFont("helvetica", "normal");
      doc.text(k.label, bx + 2, y + 7, { maxWidth: boxW - 4 });
      doc.setFontSize(9); doc.setTextColor(...C.slate900); doc.setFont("helvetica", "bold");
      doc.text(k.value, bx + 2, y + 17, { maxWidth: boxW - 4 });
    });
    y += boxH + 10;
    if (canalData.length > 0) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.slate900);
      doc.text("Canais de Venda", 20, y); y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Canal", "Pedidos", "% Pedidos", "Total Vendas"]],
        body: canalData.map((c) => [
          c.label, String(c.count),
          `${totalCanalPedidos > 0 ? ((c.count / totalCanalPedidos) * 100).toFixed(1) : "0"}%`,
          fmtShort(c.valor),
        ]),
        ...TABLE_STYLES,
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }
    if (pagamentoData.length > 0) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.slate900);
      doc.text("Formas de Pagamento", 20, y); y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Forma", "Pedidos", "%"]],
        body: pagamentoData.map((p) => [
          p.label, String(p.count),
          `${totalPagPedidos > 0 ? ((p.count / totalPagPedidos) * 100).toFixed(1) : "0"}%`,
        ]),
        ...TABLE_STYLES,
      });
    }
    addPdfFooter(doc, "Dashboard — Relatório Sintético");
    doc.save(`dashboard-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.pdf`);
  }

  async function exportAnaliticoPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const lettering = await loadLetteringDataUrl();
    const y = buildPdfHeader(doc, "Dashboard — Relatório Analítico", pizzaria?.nome ?? "", [`Período: ${PERIOD_LABELS[period]}`], lettering);
    autoTable(doc, {
      startY: y,
      head: [["Semana", "Faturamento (R$)", "Pedidos"]],
      body: chartData.map(d => [d.label, fmtShort(d.faturamento), String(d.pedidos)]),
      ...TABLE_STYLES,
    });
    addPdfFooter(doc, "Dashboard — Relatório Analítico");
    doc.save(`dashboard-analitico-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.pdf`);
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpis.map(k => ({ "Indicador": k.label, "Valor": k.value }))), "KPIs");
    if (canalData.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(canalData.map(c => ({
        "Canal": c.label, "Pedidos": c.count, "Total Vendas": c.valor,
      }))), "Canais");
    }
    if (pagamentoData.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pagamentoData.map(p => ({
        "Forma": p.label, "Pedidos": p.count,
      }))), "Pagamentos");
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(chartData.map(d => ({
      "Semana": d.label, "Faturamento (R$)": d.faturamento, "Pedidos": d.pedidos,
    }))), "Evolução");
    XLSX.writeFile(wb, `dashboard-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.xlsx`);
  }

  function exportCSV() {
    const rows = chartData.map(d => `${d.label},${d.faturamento},${d.pedidos}`);
    const blob = new Blob(["Semana,Faturamento,Pedidos\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `dashboard-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  if (!pizzaria) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      Nenhuma pizzaria vinculada à sua conta. Entre em contato com o gestor.
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">{pizzaria.nome} — visão geral da campanha</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide">Relatórios PDF</DropdownMenuLabel>
            <DropdownMenuItem onClick={exportSinteticoPDF} className="gap-2 text-xs"><BarChart2 className="h-3.5 w-3.5" /> Relatório Sintético</DropdownMenuItem>
            <DropdownMenuItem onClick={exportAnaliticoPDF} className="gap-2 text-xs"><List className="h-3.5 w-3.5" /> Relatório Analítico</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide">Dados</DropdownMenuLabel>
            <DropdownMenuItem onClick={exportExcel} className="gap-2 text-xs"><FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem onClick={exportCSV} className="gap-2 text-xs"><FileText className="h-3.5 w-3.5" /> CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">{k.label}</CardTitle>
              <k.icon className={`h-4 w-4 ${k.color} flex-shrink-0`} />
            </CardHeader>
            <CardContent><p className="text-xl font-bold font-heading">{k.value}</p></CardContent>
          </Card>
        ))}
      </div>

      {/* Sales area chart */}
      <Card className="border-border bg-card">
        <CardHeader className="space-y-3 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" /> Gráfico de Vendas
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1">
                  <TrendingUp className="h-3 w-3" /> {METRIC_LABELS[metric]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
                  <DropdownMenuItem key={m} onClick={() => setMetric(m)} className={`text-xs ${metric === m ? "font-bold" : ""}`}>
                    {METRIC_LABELS[m]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1">
                  {PERIOD_LABELS[period]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(Object.keys(PERIOD_LABELS) as QuickPeriod[]).map((p) => (
                  <DropdownMenuItem key={p} onClick={() => setPeriod(p)} className={`text-xs ${period === p ? "font-bold" : ""}`}>
                    {PERIOD_LABELS[p]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{ faturamento: { label: "Faturamento", color: "hsl(25 95% 53%)" }, pedidos: { label: "Pedidos", color: "hsl(25 95% 53%)" } }}
            className="h-[220px] w-full"
          >
            <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(25 95% 53%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(25 95% 53%)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 90%)" vertical={false} />
              <XAxis dataKey="label" stroke="hsl(220 10% 55%)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis
                stroke="hsl(220 10% 55%)" fontSize={10} tickLine={false} axisLine={false}
                tickFormatter={metric === "faturamento" ? fmtAxis : (v) => String(v)}
              />
              <ChartTooltip
                content={<ChartTooltipContent
                  formatter={(value) => metric === "faturamento" ? fmt(Number(value)) : String(value)}
                />}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke="hsl(25 95% 53%)"
                strokeWidth={2}
                fill="url(#areaGrad)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Bottom row: Canais + Formas de Pagamento + Info */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

        {/* Canais de Venda */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Canais de Venda</CardTitle>
          </CardHeader>
          <CardContent>
            {canalData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Sem dados no período</p>
            ) : (
              <div className="flex items-center gap-4">
                <ChartContainer config={{}} className="h-[140px] w-[140px] flex-shrink-0">
                  <PieChart>
                    <Pie data={canalData} dataKey="count" cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={2} strokeWidth={0}>
                      {canalData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                    </Pie>
                    <ChartTooltip formatter={(v, _n, props) => [`${v} pedidos`, props.payload?.label ?? ""]} />
                  </PieChart>
                </ChartContainer>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {canalData.map((c, i) => (
                    <div key={c.canal} className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <span className="truncate text-muted-foreground">{c.label}</span>
                      </div>
                      <span className="font-medium flex-shrink-0 text-foreground">
                        {totalCanalPedidos > 0 ? `${((c.count / totalCanalPedidos) * 100).toFixed(0)}%` : "0%"}
                        <span className="text-muted-foreground ml-1">({c.count})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Formas de Pagamento */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Formas de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            {pagamentoData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Sem dados no período</p>
            ) : (
              <div className="flex items-center gap-4">
                <ChartContainer config={{}} className="h-[140px] w-[140px] flex-shrink-0">
                  <PieChart>
                    <Pie data={pagamentoData} dataKey="count" cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={2} strokeWidth={0}>
                      {pagamentoData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                    </Pie>
                    <ChartTooltip formatter={(v, _n, props) => [`${v} pedidos`, props.payload?.label ?? ""]} />
                  </PieChart>
                </ChartContainer>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {pagamentoData.map((p, i) => (
                    <div key={p.key} className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <span className="truncate text-muted-foreground">{p.label}</span>
                      </div>
                      <span className="font-medium flex-shrink-0 text-foreground">
                        {totalPagPedidos > 0 ? `${((p.count / totalPagPedidos) * 100).toFixed(0)}%` : "0%"}
                        <span className="text-muted-foreground ml-1">({p.count})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Faturamento por semana (mini bar) */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Faturamento Semanal</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Sem dados no período</p>
            ) : (
              <ChartContainer config={{ faturamento: { label: "Faturamento", color: "hsl(25 95% 53%)" } }} className="h-[140px] w-full">
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                  <XAxis dataKey="label" fontSize={8} stroke="hsl(220 10% 55%)" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis hide tickFormatter={fmtAxis} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />} />
                  <Bar dataKey="faturamento" fill="hsl(25 95% 53%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

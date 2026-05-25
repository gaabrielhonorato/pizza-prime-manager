import { useMemo, useState, useEffect } from "react";
import { DollarSign, ShoppingBag, ArrowDownRight, Ticket, Target, TrendingUp, Download, BarChart2, List, FileSpreadsheet, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subDays, eachDayOfInterval, startOfDay, endOfDay, isSameDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useMinhaPizzaria } from "@/contexts/MinhaPizzariaContext";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter } from "@/lib/pdf-helpers";

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

const CANAL_LABELS: Record<string, string> = {
  cardapioweb: "Cardápio Web", whatsapp: "WhatsApp", balcao: "Balcão",
  anuncios: "Anúncios", indicacao: "Indicação", outros: "Outros",
};

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtShort = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

export default function PizzariaDashboard() {
  const { pizzaria, stats, loading } = useMinhaPizzaria();
  const [period, setPeriod] = useState<QuickPeriod>("este_mes");
  const [chartData, setChartData] = useState<{ label: string; pedidos: number }[]>([]);
  const [percentualPP, setPercentualPP] = useState(15);
  const [canalData, setCanalData] = useState<{ canal: string; count: number; valor: number }[]>([]);
  const [periodStats, setPeriodStats] = useState({ vendas: 0, pedidos: 0 });

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
    const [from, to] = getRange(period);

    async function fetchChart() {
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("data_pedido, canal, valor_total")
        .eq("pizzaria_id", pizzaria!.id)
        .gte("data_pedido", from.toISOString())
        .lte("data_pedido", to.toISOString());

      const days = eachDayOfInterval({ start: from, end: to });
      setChartData(days.map((d) => ({
        label: format(d, "dd/MM"),
        pedidos: pedidos?.filter((p) => isSameDay(new Date(p.data_pedido), d)).length ?? 0,
      })));

      const byCanal: Record<string, { count: number; valor: number }> = {};
      (pedidos ?? []).forEach((p) => {
        const c = p.canal || "outros";
        if (!byCanal[c]) byCanal[c] = { count: 0, valor: 0 };
        byCanal[c].count++;
        byCanal[c].valor += Number(p.valor_total);
      });
      setCanalData(
        Object.entries(byCanal)
          .map(([canal, v]) => ({ canal, ...v }))
          .sort((a, b) => b.count - a.count)
      );

      setPeriodStats({
        vendas: (pedidos ?? []).reduce((s, p) => s + Number(p.valor_total), 0),
        pedidos: pedidos?.length ?? 0,
      });
    }
    fetchChart();
  }, [pizzaria, period]);

  const pizzariaShare = 100 - percentualPP;
  const repasse = Math.round(stats.vendasMes * pizzariaShare / 100);
  const ticketMedio = stats.pedidosMes > 0 ? Math.round(stats.vendasMes / stats.pedidosMes) : 0;
  const metaMensal = pizzaria?.metaMensal ?? 0;
  const metaProgress = metaMensal > 0 ? Math.min((stats.vendasMes / metaMensal) * 100, 100) : 0;
  const metaAtingida = metaMensal > 0 && stats.vendasMes >= metaMensal;
  const faltaMeta = metaMensal > 0 ? Math.max(metaMensal - stats.vendasMes, 0) : 0;
  const periodTicket = periodStats.pedidos > 0 ? Math.round(periodStats.vendas / periodStats.pedidos) : 0;
  const totalCanalPedidos = canalData.reduce((s, c) => s + c.count, 0);

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
    let y = buildPdfHeader(doc, "Dashboard — Relatório Sintético", pizzaria?.nome ?? "", [`Período: ${LABELS[period]}`], lettering);
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
    if (pizzaria && metaMensal > 0) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.slate900);
      doc.text(`Meta Mensal: ${metaProgress.toFixed(1)}% atingida`, 20, y); y += 8;
    }
    if (canalData.length > 0) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.slate900);
      doc.text(`Distribuição por Canal — ${LABELS[period]}`, 20, y); y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Canal", "Pedidos", "% Pedidos", "Total Vendas"]],
        body: canalData.map((c) => [
          CANAL_LABELS[c.canal] ?? c.canal,
          String(c.count),
          `${totalCanalPedidos > 0 ? ((c.count / totalCanalPedidos) * 100).toFixed(1) : "0"}%`,
          fmtShort(c.valor),
        ]),
        ...TABLE_STYLES,
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }
    if (chartData.length > 0) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.slate900);
      doc.text(`Pedidos por Dia — ${LABELS[period]}`, 20, y); y += 6;
      autoTable(doc, { startY: y, head: [["Data", "Pedidos"]], body: chartData.map(d => [d.label, String(d.pedidos)]), ...TABLE_STYLES });
    }
    addPdfFooter(doc, "Dashboard — Relatório Sintético");
    doc.save(`dashboard-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.pdf`);
  }

  async function exportAnaliticoPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const lettering = await loadLetteringDataUrl();
    const y = buildPdfHeader(doc, "Dashboard — Relatório Analítico", pizzaria?.nome ?? "", [`Período: ${LABELS[period]}`], lettering);
    autoTable(doc, {
      startY: y, head: [["Data", "Pedidos"]],
      body: chartData.map(d => [d.label, String(d.pedidos)]), ...TABLE_STYLES,
    });
    addPdfFooter(doc, "Dashboard — Relatório Analítico");
    doc.save(`dashboard-analitico-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.pdf`);
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const wsKpis = XLSX.utils.json_to_sheet(kpis.map(k => ({ "Indicador": k.label, "Valor": k.value })));
    XLSX.utils.book_append_sheet(wb, wsKpis, "KPIs");
    if (canalData.length > 0) {
      const wsCan = XLSX.utils.json_to_sheet(canalData.map(c => ({
        "Canal": CANAL_LABELS[c.canal] ?? c.canal, "Pedidos": c.count, "Total Vendas": c.valor,
      })));
      XLSX.utils.book_append_sheet(wb, wsCan, "Por Canal");
    }
    const wsChart = XLSX.utils.json_to_sheet(chartData.map(d => ({ "Data": d.label, "Pedidos": d.pedidos })));
    XLSX.utils.book_append_sheet(wb, wsChart, "Pedidos por Dia");
    XLSX.writeFile(wb, `dashboard-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.xlsx`);
  }

  function exportCSV() {
    const header = "Data,Pedidos";
    const rows = chartData.map(d => `${d.label},${d.pedidos}`);
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
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

      {/* Meta progress */}
      {metaMensal > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">Meta Mensal</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{metaProgress.toFixed(1)}%</span>
                {metaAtingida && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]" variant="outline">Meta atingida!</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${metaAtingida ? "bg-emerald-500" : "bg-primary"}`}
                style={{ width: `${metaProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Vendido: <strong className="text-foreground">{fmtShort(stats.vendasMes)}</strong></span>
              <span>Meta: <strong className="text-foreground">{fmtShort(metaMensal)}</strong></span>
            </div>
            {!metaAtingida && faltaMeta > 0 && (
              <p className="text-xs text-muted-foreground">
                Faltam <strong className="text-foreground">{fmtShort(faltaMeta)}</strong> para atingir a meta.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chart + Canal breakdown side by side */}
      <div className={`grid gap-4 ${canalData.length > 0 ? "lg:grid-cols-3" : ""}`}>
        <Card className={`border-border bg-card ${canalData.length > 0 ? "lg:col-span-2" : ""}`}>
          <CardHeader className="space-y-3 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pedidos por dia</CardTitle>
              {period !== "este_mes" && periodStats.pedidos > 0 && (
                <span className="text-xs text-muted-foreground">
                  {periodStats.pedidos} pedidos · ticket {fmtShort(periodTicket)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(LABELS) as QuickPeriod[]).map((p) => (
                <Button key={p} variant={period === p ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setPeriod(p)}>
                  {LABELS[p]}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ pedidos: { label: "Pedidos", color: "hsl(25 95% 53%)" } }} className="h-[220px] w-full">
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="label" stroke="hsl(220 10% 55%)" fontSize={10} interval="preserveStartEnd" />
                <YAxis stroke="hsl(220 10% 55%)" fontSize={11} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="pedidos" fill="hsl(25 95% 53%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {canalData.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Por canal — {LABELS[period]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canalData.map((c) => {
                const pct = totalCanalPedidos > 0 ? (c.count / totalCanalPedidos) * 100 : 0;
                return (
                  <div key={c.canal} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{CANAL_LABELS[c.canal] ?? c.canal}</span>
                      <span className="text-muted-foreground">{c.count} pedidos · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{fmt(c.valor)}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Info card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start gap-4">
          <div className="flex-1 space-y-1">
            <h3 className="font-heading font-bold text-base">{pizzaria.nome}</h3>
            <p className="text-sm text-muted-foreground">
              Status: <strong className="text-primary">{pizzaria.status}</strong>
              {pizzaria.cidade ? ` · ${pizzaria.cidade}` : ""}
              {metaMensal > 0 ? ` · Meta: ${fmtShort(metaMensal)}/mês` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Participando desde {pizzaria.dataEntrada ? format(new Date(pizzaria.dataEntrada + "T00:00:00"), "MMMM/yyyy") : "—"}.
              Continue participando para acumular cupons com seus clientes!
            </p>
          </div>
          {stats.cuponsCiclo > 0 && (
            <div className="rounded-lg bg-primary/10 px-4 py-2 text-center">
              <p className="text-2xl font-bold text-primary">{stats.cuponsCiclo}</p>
              <p className="text-xs text-muted-foreground">cupons ativos</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

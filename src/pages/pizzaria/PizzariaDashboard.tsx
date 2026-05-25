import { useMemo, useState, useEffect } from "react";
import { DollarSign, ShoppingBag, ArrowDownRight, Ticket, Trophy, Download, BarChart2, List, FileSpreadsheet, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subDays, eachDayOfInterval, startOfDay, endOfDay, isSameDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default function PizzariaDashboard() {
  const { pizzaria, stats, loading } = useMinhaPizzaria();
  const [period, setPeriod] = useState<QuickPeriod>("este_mes");
  const [chartData, setChartData] = useState<{ label: string; pedidos: number }[]>([]);
  const [percentualPP, setPercentualPP] = useState(15);

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
        if (data?.percentual_pizza_premiada) {
          setPercentualPP(Number(data.percentual_pizza_premiada));
        }
      });
  }, [pizzaria]);

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

  const pizzariaShare = 100 - percentualPP;
  const repasse = Math.round(stats.vendasMes * pizzariaShare / 100);

  const kpis = useMemo(() => [
    { label: "Vendas do mês", value: `R$ ${stats.vendasMes.toLocaleString("pt-BR")}`, icon: DollarSign },
    { label: "Pedidos do mês", value: String(stats.pedidosMes), icon: ShoppingBag },
    { label: `Repasse estimado (${pizzariaShare}%)`, value: `R$ ${repasse.toLocaleString("pt-BR")}`, icon: ArrowDownRight },
    { label: "Cupons gerados no ciclo", value: String(stats.cuponsCiclo), icon: Ticket },
  ], [stats, repasse, pizzariaShare]);

  async function exportSinteticoPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const lettering = await loadLetteringDataUrl();
    let y = buildPdfHeader(doc, "Dashboard — Relatório Sintético", pizzaria?.nome ?? "", [`Período: ${LABELS[period]}`], lettering);

    const boxW = 42; const boxH = 22; const gap = 4; const startX = 20;
    kpis.forEach((k, i) => {
      const bx = startX + i * (boxW + gap);
      doc.setFillColor(...C.slate50); doc.setDrawColor(...C.slate200); doc.setLineWidth(0.4);
      doc.rect(bx, y, boxW, boxH, "FD");
      doc.setFontSize(6); doc.setTextColor(...C.slate500); doc.setFont("helvetica", "normal");
      doc.text(k.label, bx + 3, y + 7, { maxWidth: boxW - 6 });
      doc.setFontSize(9); doc.setTextColor(...C.slate900); doc.setFont("helvetica", "bold");
      doc.text(k.value, bx + 3, y + 17, { maxWidth: boxW - 6 });
    });
    y += boxH + 10;

    if (pizzaria) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.slate900);
      doc.text("Informações da Pizzaria", 20, y); y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Campo", "Valor"]],
        body: [
          ["Nome", pizzaria.nome],
          ["Cidade", pizzaria.cidade],
          ["Status", pizzaria.status],
          ["Meta Mensal", `R$ ${pizzaria.metaMensal.toLocaleString("pt-BR")}`],
        ],
        ...TABLE_STYLES,
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (chartData.length > 0) {
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.slate900);
      doc.text(`Pedidos por Dia — ${LABELS[period]}`, 20, y); y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Data", "Pedidos"]],
        body: chartData.map(d => [d.label, String(d.pedidos)]),
        ...TABLE_STYLES,
      });
    }

    addPdfFooter(doc, "Dashboard — Relatório Sintético");
    doc.save(`dashboard-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.pdf`);
  }

  async function exportAnaliticoPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const lettering = await loadLetteringDataUrl();
    const y = buildPdfHeader(doc, "Dashboard — Relatório Analítico", pizzaria?.nome ?? "", [`Período: ${LABELS[period]}`], lettering);

    autoTable(doc, {
      startY: y,
      head: [["Data", "Pedidos"]],
      body: chartData.map(d => [d.label, String(d.pedidos)]),
      ...TABLE_STYLES,
    });

    addPdfFooter(doc, "Dashboard — Relatório Analítico");
    doc.save(`dashboard-analitico-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.pdf`);
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const wsKpis = XLSX.utils.json_to_sheet(kpis.map(k => ({ "Indicador": k.label, "Valor": k.value })));
    XLSX.utils.book_append_sheet(wb, wsKpis, "KPIs");
    const wsChart = XLSX.utils.json_to_sheet(chartData.map(d => ({ "Data": d.label, "Pedidos": d.pedidos })));
    XLSX.utils.book_append_sheet(wb, wsChart, "Pedidos por Dia");
    XLSX.writeFile(wb, `dashboard-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.xlsx`);
  }

  function exportCSV() {
    const header = "Data,Pedidos";
    const rows = chartData.map(d => `${d.label},${d.pedidos}`);
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral da sua pizzaria na campanha.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide">Relatórios PDF</DropdownMenuLabel>
            <DropdownMenuItem onClick={exportSinteticoPDF} className="gap-2 text-xs">
              <BarChart2 className="h-3.5 w-3.5" /> Relatório Sintético
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportAnaliticoPDF} className="gap-2 text-xs">
              <List className="h-3.5 w-3.5" /> Relatório Analítico
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wide">Dados</DropdownMenuLabel>
            <DropdownMenuItem onClick={exportExcel} className="gap-2 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportCSV} className="gap-2 text-xs">
              <FileText className="h-3.5 w-3.5" /> CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
              Status: <strong className="text-primary">{pizzaria.status}</strong> ·{" "}
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

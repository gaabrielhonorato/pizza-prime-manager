import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import { TrendingUp, TrendingDown, DollarSign, Percent, BarChart3, Landmark, Clock, Download, FileSpreadsheet, FileText, BarChart2, List, Receipt, CheckCircle, Send, CalendarDays, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import TablePagination from "@/components/gestor/TablePagination";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter, drawSectionTitle } from "@/lib/pdf-helpers";
import { startOfDay, endOfDay, subMonths, startOfMonth, startOfYear, format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

type FinQuick = "ciclo" | "3m" | "6m" | "ano" | "custom";

const FIN_QUICK_LABELS: Record<FinQuick, string> = {
  ciclo: "Toda a campanha",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  ano: "Este ano",
  custom: "Personalizado",
};

const chartConfig = {
  receita: { label: "Receita PP",  color: "hsl(25 95% 53%)" },
  custos:  { label: "Custos",      color: "hsl(var(--destructive))" },
  lucro:   { label: "Lucro",       color: "hsl(var(--primary))" },
};

interface ContextType { selectedCampanha: string; filterSlot: HTMLDivElement | null; exportSlot: HTMLDivElement | null; }

export default function FinanceiroVisaoGeral() {
  const { selectedCampanha, filterSlot, exportSlot } = useOutletContext<ContextType>();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pizzarias, setPizzarias] = useState<any[]>([]);
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [custosOp, setCustosOp] = useState<any[]>([]);
  const [custosLeg, setCustosLeg] = useState<any[]>([]);
  const [comissao, setComissao] = useState(15);
  const [loading, setLoading] = useState(true);
  const [detailDrawer, setDetailDrawer] = useState<any>(null);

  const [finQuick, setFinQuick] = useState<FinQuick>("ciclo");
  const [finFrom, setFinFrom] = useState<Date>(new Date(0));
  const [finTo, setFinTo] = useState<Date>(endOfDay(new Date()));
  const [finFromStr, setFinFromStr] = useState("");
  const [finToStr, setFinToStr] = useState("");

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const selectFinQuick = (q: FinQuick) => {
    setFinQuick(q);
    const today = new Date();
    let f: Date, t: Date;
    switch (q) {
      case "ciclo": f = new Date(0); t = endOfDay(today); break;
      case "3m": f = startOfDay(subMonths(today, 3)); t = endOfDay(today); break;
      case "6m": f = startOfDay(subMonths(today, 6)); t = endOfDay(today); break;
      case "ano": f = startOfYear(today); t = endOfDay(today); break;
      default: return;
    }
    setFinFrom(f); setFinTo(t);
    if (q !== "ciclo") { setFinFromStr(format(f, "yyyy-MM-dd")); setFinToStr(format(t, "yyyy-MM-dd")); }
  };

  const applyFinCustom = () => {
    if (finFromStr && finToStr) {
      setFinQuick("custom");
      setFinFrom(startOfDay(new Date(finFromStr + "T00:00:00")));
      setFinTo(endOfDay(new Date(finToStr + "T00:00:00")));
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let campId = selectedCampanha;
      if (campId === "todas") {
        const { data: cp } = await supabase.from("campanhas").select("id, percentual_comissao").eq("is_principal", true).limit(1).single();
        campId = cp?.id ?? "";
        setComissao(Number(cp?.percentual_comissao ?? 15));
      } else {
        const { data: cp } = await supabase.from("campanhas").select("percentual_comissao").eq("id", campId).single();
        setComissao(Number(cp?.percentual_comissao ?? 15));
      }
      let pedQ = supabase.from("pedidos").select("valor_total, data_pedido, campanha_id, consumidor_id").eq("status", "entregue");
      if (selectedCampanha !== "todas") pedQ = pedQ.eq("campanha_id", selectedCampanha);
      let cobQ = supabase.from("cobrancas_repasse").select("*");
      if (selectedCampanha !== "todas") cobQ = cobQ.eq("campanha_id", selectedCampanha);
      let coOpQ = supabase.from("custos_operacionais").select("*");
      if (selectedCampanha !== "todas") coOpQ = coOpQ.eq("campanha_id", selectedCampanha);
      let cusQ = supabase.from("custos").select("*");
      if (selectedCampanha !== "todas") cusQ = cusQ.eq("campanha_id", selectedCampanha);

      const [{ data: p }, { data: pz }, { data: validConsumers }, { data: cob }, { data: co }, { data: cl }] = await Promise.all([
        pedQ,
        supabase.from("pizzarias").select("id, nome"),
        supabase.from("consumidores").select("id, usuarios(nome, telefone)"),
        cobQ.order("criado_em", { ascending: false }),
        coOpQ,
        cusQ,
      ]);
      const validIds = new Set((validConsumers ?? []).filter((c: any) => c.usuarios?.nome && c.usuarios?.telefone).map((c: any) => c.id));
      setPedidos((p ?? []).filter((ped: any) => validIds.has(ped.consumidor_id)));
      setPizzarias(pz ?? []);
      setCobrancas(cob ?? []);
      setCustosOp(co ?? []);
      setCustosLeg(cl ?? []);
      setLoading(false);
    };
    fetchData();
  }, [selectedCampanha]);

  const pctDecimal = comissao / 100;

  const filteredPedidos = useMemo(() => {
    if (finQuick === "ciclo") return pedidos;
    return pedidos.filter(p => { const d = new Date(p.data_pedido); return d >= finFrom && d <= finTo; });
  }, [pedidos, finQuick, finFrom, finTo]);

  const stats = useMemo(() => {
    const totalVendas = filteredPedidos.reduce((s, p) => s + Number(p.valor_total), 0);
    const fatPP = totalVendas * pctDecimal;
    const fatTotal = fatPP;
    const fatPizzarias = totalVendas * (1 - pctDecimal);
    const totalCustosOp = custosOp.reduce((s, c) => s + Number(c.valor_total_calculado), 0);
    const totalCustosLeg = custosLeg.reduce((s, c) => s + Number(c.valor), 0);
    const totalCustos = totalCustosOp + totalCustosLeg;
    const lucro = fatTotal - totalCustos;
    const margem = fatTotal > 0 ? (lucro / fatTotal) * 100 : 0;
    return { fatTotal, fatPP, fatPizzarias, totalCustos, lucro, margem };
  }, [filteredPedidos, custosOp, custosLeg, pctDecimal]);

  const chartData = useMemo(() => {
    const byMonth: Record<string, { vendas: number }> = {};
    filteredPedidos.forEach(p => {
      const m = new Date(p.data_pedido).toISOString().slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { vendas: 0 };
      byMonth[m].vendas += Number(p.valor_total);
    });
    const totalCustosMes = stats.totalCustos / Math.max(Object.keys(byMonth).length, 1);
    return Object.entries(byMonth).sort().map(([mes, d]) => {
      const recPP = d.vendas * pctDecimal;
      return { mes: mes.split("-").reverse().join("/"), receita: recPP, custos: totalCustosMes, lucro: recPP - totalCustosMes };
    });
  }, [filteredPedidos, stats.totalCustos, pctDecimal]);

  const tableData = useMemo(() => {
    const byMonth: Record<string, number> = {};
    filteredPedidos.forEach(p => {
      const m = new Date(p.data_pedido).toISOString().slice(0, 7);
      byMonth[m] = (byMonth[m] || 0) + Number(p.valor_total);
    });
    const months = Object.keys(byMonth).sort();
    const custoMes = stats.totalCustos / Math.max(months.length, 1);
    return months.map((m: string) => {
      const v = byMonth[m];
      const pp = v * pctDecimal;
      const pz = v * (1 - pctDecimal);
      const lucro = pp - custoMes;
      return { mes: m.split("-").reverse().join("/"), fatTotal: v, fatPP: pp, fatPizzarias: pz, custos: custoMes, lucro, margem: pp > 0 ? (lucro / pp) * 100 : 0 };
    });
  }, [filteredPedidos, stats.totalCustos, pctDecimal]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(tableData.length / pageSize));
  const pagedTable = pageSize === 0 ? tableData : tableData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const cobrancasStats = useMemo(() => ({
    pendente: cobrancas.filter(c => c.status === "pendente").reduce((s, c) => s + Number(c.valor_total_devido), 0),
    agendado: cobrancas.filter(c => c.status === "agendado").reduce((s, c) => s + Number(c.valor_total_devido), 0),
    enviado:  cobrancas.filter(c => c.status === "enviado").reduce((s, c) => s + Number(c.valor_total_devido), 0),
    pago:     cobrancas.filter(c => c.status === "pago").reduce((s, c) => s + Number(c.valor_total_devido), 0),
    qtdPendente: cobrancas.filter(c => c.status === "pendente").length,
    qtdAgendado: cobrancas.filter(c => c.status === "agendado").length,
    qtdEnviado:  cobrancas.filter(c => c.status === "enviado").length,
    qtdPago:     cobrancas.filter(c => c.status === "pago").length,
  }), [cobrancas]);

  const pzName = (id: string) => pizzarias.find(p => p.id === id)?.nome ?? "—";

  const statusBadge = (s: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      pendente: { cls: "bg-muted text-muted-foreground", label: "Pendente" },
      agendado: { cls: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Agendado" },
      enviado:  { cls: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Aguardando" },
      pago:     { cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Pago" },
      cancelado:{ cls: "bg-destructive/20 text-destructive", label: "Cancelado" },
    };
    const m = map[s] ?? map.pendente;
    return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const finPeriodLabel = finQuick === "ciclo" ? FIN_QUICK_LABELS.ciclo : finQuick === "custom"
    ? `${format(finFrom, "dd/MM/yyyy")} – ${format(finTo, "dd/MM/yyyy")}`
    : FIN_QUICK_LABELS[finQuick];

  const filterLines = [`Período: ${finPeriodLabel}`];

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const header = ["Mês", "Fat. Total", `Fat. PP (${comissao}%)`, `Fat. Pizzarias (${100 - comissao}%)`, "Custos", "Lucro", "Margem %"];
    const rows = tableData.map(r => [r.mes, fmt(r.fatTotal), fmt(r.fatPP), fmt(r.fatPizzarias), fmt(r.custos), fmt(r.lucro), fmtPct(r.margem)]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = header.map((h, i) => ({ wch: Math.min(Math.max(h.length, ...rows.map(r => String(r[i]).length)) + 2, 50) }));
    XLSX.utils.book_append_sheet(wb, ws, "Resumo Mensal");
    const meta = [["Data de exportação", format(new Date(), "dd/MM/yyyy HH:mm")], ["Período", finPeriodLabel], ["Total de registros", String(tableData.length)]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), "Metadados");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
    const a = document.createElement("a"); a.href = url; a.download = `financeiro-visao-geral-${today}.xlsx`; a.click(); URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const header = ["Mês", `Fat. Total`, `Fat. PP (${comissao}%)`, `Fat. Pizzarias (${100 - comissao}%)`, "Custos", "Lucro", "Margem %"].join(",");
    const rows = tableData.map(r => [r.mes, fmt(r.fatTotal), fmt(r.fatPP), fmt(r.fatPizzarias), fmt(r.custos), fmt(r.lucro), fmtPct(r.margem)].map(v => typeof v === "string" && v.includes(",") ? `"${v}"` : v).join(","));
    const csv = [header, ...rows].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `financeiro-visao-geral-${today}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportSinteticoPDF = async () => {
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    let y = buildPdfHeader(doc, "Visão Geral Financeira", "Relatório Sintético", filterLines, lettering);

    y = drawSectionTitle(doc, "KPIs Principais", y);
    const kpiData = [
      ["Faturamento Total", fmt(stats.fatTotal)],
      [`Receita PP (${comissao}%)`, fmt(stats.fatPP)],
      [`Fat. Pizzarias (${100 - comissao}%)`, fmt(stats.fatPizzarias)],
      ["Total de Custos", fmt(stats.totalCustos)],
      ["Lucro Líquido", fmt(stats.lucro)],
      ["Margem %", fmtPct(stats.margem)],
    ];
    autoTable(doc, { ...TABLE_STYLES, head: [["Indicador", "Valor"]], body: kpiData, startY: y, tableWidth: 300 });
    y = (doc as any).lastAutoTable.finalY + 16;

    y = drawSectionTitle(doc, "Resumo Mensal", y);
    autoTable(doc, {
      ...TABLE_STYLES,
      head: [["Mês", "Fat. Total", `Fat. PP (${comissao}%)`, `Fat. Piz. (${100 - comissao}%)`, "Custos", "Lucro", "Margem %"]],
      body: tableData.map(r => [r.mes, fmt(r.fatTotal), fmt(r.fatPP), fmt(r.fatPizzarias), fmt(r.custos), fmt(r.lucro), fmtPct(r.margem)]),
      startY: y,
    });
    addPdfFooter(doc, "Visão Geral Financeira — Sintético");
    doc.save(`financeiro-visao-geral-sintetico-${today}.pdf`);
  };

  const exportAnaliticoPDF = async () => {
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    let y = buildPdfHeader(doc, "Visão Geral Financeira", "Relatório Analítico — Mês a Mês", filterLines, lettering);

    autoTable(doc, {
      ...TABLE_STYLES,
      head: [["Mês", "Fat. Total", `Fat. PP (${comissao}%)`, `Fat. Pizzarias (${100 - comissao}%)`, "Custos", "Lucro", "Margem %"]],
      body: tableData.map(r => [r.mes, fmt(r.fatTotal), fmt(r.fatPP), fmt(r.fatPizzarias), fmt(r.custos), fmt(r.lucro), fmtPct(r.margem)]),
      startY: y,
    });
    addPdfFooter(doc, "Visão Geral Financeira — Analítico");
    doc.save(`financeiro-visao-geral-analitico-${today}.pdf`);
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;

  const cards = [
    { label: "Faturamento Total", value: fmt(stats.fatTotal), icon: Landmark, color: "text-primary" },
    { label: `Receita Vendas (${comissao}%)`, value: fmt(stats.fatPP), icon: TrendingUp, color: "text-success" },
    { label: `Faturamento Pizzarias (${100 - comissao}%)`, value: fmt(stats.fatPizzarias), icon: BarChart3, color: "text-muted-foreground" },
    { label: "Total de Custos", value: fmt(stats.totalCustos), icon: TrendingDown, color: "text-destructive" },
    { label: "Lucro Líquido", value: fmt(stats.lucro), icon: DollarSign, color: stats.lucro >= 0 ? "text-success" : "text-destructive" },
    { label: "Margem %", value: fmtPct(stats.margem), icon: Percent, color: stats.margem >= 0 ? "text-success" : "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      {filterSlot && createPortal(
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {finPeriodLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3 space-y-3" align="start">
            <p className="text-xs font-medium text-muted-foreground">Período</p>
            <div className="flex flex-wrap gap-1.5">
              {(["ciclo", "3m", "6m", "ano"] as FinQuick[]).map((q) => (
                <Button key={q} variant={finQuick === q ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => selectFinQuick(q)}>
                  {FIN_QUICK_LABELS[q]}
                </Button>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Personalizado</p>
              <div className="flex items-center gap-1">
                <Input type="date" className="h-7 text-xs" value={finFromStr} onChange={(e) => setFinFromStr(e.target.value)} />
                <span className="text-xs text-muted-foreground">–</span>
                <Input type="date" className="h-7 text-xs" value={finToStr} onChange={(e) => setFinToStr(e.target.value)} />
              </div>
              <Button size="sm" className="text-xs h-7 w-full" onClick={applyFinCustom} disabled={!finFromStr || !finToStr}>Aplicar</Button>
            </div>
          </PopoverContent>
        </Popover>,
        filterSlot,
      )}

      {exportSlot && createPortal(
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
        </DropdownMenu>,
        exportSlot,
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(c => (
          <Card key={c.label} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <c.icon className={`h-5 w-5 ${c.color}`} />
              <CardTitle className="text-sm text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent><p className={`text-2xl font-heading font-bold ${c.color}`}>{c.value}</p></CardContent>
          </Card>
        ))}
      </div>

      {chartData.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="font-heading">Receitas vs Custos vs Lucro</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="vg-receita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(25 95% 53%)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(25 95% 53%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="vg-custos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="vg-lucro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke="hsl(var(--border))" strokeWidth={0.8} vertical={false} />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} axisLine={false} tickLine={false} dy={8} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} axisLine={false} tickLine={false} width={68} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v: any) => fmt(Number(v))} />} />
                <Area type="monotone" dataKey="receita" stroke="hsl(25 95% 53%)" strokeWidth={2} fill="url(#vg-receita)" dot={false} />
                <Area type="monotone" dataKey="custos" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#vg-custos)" dot={false} />
                <Area type="monotone" dataKey="lucro" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#vg-lucro)" dot={false} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading">Resumo Mensal</CardTitle>
          <TablePagination total={tableData.length} pageSize={pageSize} currentPage={currentPage} onPageSizeChange={setPageSize} onPageChange={setCurrentPage} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead><TableHead className="text-right">Fat. Total</TableHead>
                <TableHead className="text-right">Fat. PP ({comissao}%)</TableHead><TableHead className="text-right">Fat. Pizzarias ({100 - comissao}%)</TableHead>
                <TableHead className="text-right">Custos</TableHead><TableHead className="text-right">Lucro</TableHead>
                <TableHead className="text-right">Margem %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedTable.map(r => (
                <TableRow key={r.mes}>
                  <TableCell>{r.mes}</TableCell>
                  <TableCell className="text-right">{fmt(r.fatTotal)}</TableCell>
                  <TableCell className="text-right">{fmt(r.fatPP)}</TableCell>
                  <TableCell className="text-right">{fmt(r.fatPizzarias)}</TableCell>
                  <TableCell className="text-right">{fmt(r.custos)}</TableCell>
                  <TableCell className={`text-right font-medium ${r.lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmt(r.lucro)}</TableCell>
                  <TableCell className={`text-right ${r.margem >= 0 ? "text-success" : "text-destructive"}`}>{fmtPct(r.margem)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-bold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{fmt(stats.fatTotal)}</TableCell>
                <TableCell className="text-right">{fmt(stats.fatPP)}</TableCell>
                <TableCell className="text-right">{fmt(stats.fatPizzarias)}</TableCell>
                <TableCell className="text-right">{fmt(stats.totalCustos)}</TableCell>
                <TableCell className={`text-right ${stats.lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmt(stats.lucro)}</TableCell>
                <TableCell className={`text-right ${stats.margem >= 0 ? "text-success" : "text-destructive"}`}>{fmtPct(stats.margem)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {/* ── Cobranças — KPIs ── */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" /> Cobranças de Comissão
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm text-muted-foreground">Pendente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{fmt(cobrancasStats.pendente)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{cobrancasStats.qtdPendente} cobrança{cobrancasStats.qtdPendente !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <CalendarDays className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-sm text-muted-foreground">Agendado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-blue-400">{fmt(cobrancasStats.agendado)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{cobrancasStats.qtdAgendado} cobrança{cobrancasStats.qtdAgendado !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Send className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-sm text-muted-foreground">Aguardando pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-amber-400">{fmt(cobrancasStats.enviado)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{cobrancasStats.qtdEnviado} cobrança{cobrancasStats.qtdEnviado !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <CardTitle className="text-sm text-muted-foreground">Recebido</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-emerald-400">{fmt(cobrancasStats.pago)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{cobrancasStats.qtdPago} cobrança{cobrancasStats.qtdPago !== 1 ? "s" : ""} paga{cobrancasStats.qtdPago !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Lista de cobranças geradas ── */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="font-heading text-base">Cobranças geradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cobrancas.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhuma cobrança gerada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Pizzaria</TableHead>
                  <TableHead className="text-xs">Período</TableHead>
                  <TableHead className="text-xs text-center">Pedidos</TableHead>
                  <TableHead className="text-xs text-right">Valor devido</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobrancas.slice(0, 15).map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm font-medium">{pzName(c.pizzaria_id)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.periodo_inicio} – {c.periodo_fim}</TableCell>
                    <TableCell className="text-xs text-center">{Array.isArray(c.pedidos_snapshot) ? c.pedidos_snapshot.length : 0}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{fmt(Number(c.valor_total_devido))}</TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(c.criado_em), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailDrawer(c)} title="Ver detalhes">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Drawer de detalhes da cobrança ── */}
      <Sheet open={!!detailDrawer} onOpenChange={o => !o && setDetailDrawer(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle>Detalhes da Cobrança</SheetTitle></SheetHeader>
          {detailDrawer && (
            <div className="space-y-4 mt-4 text-sm">
              <div className="space-y-1">
                <p><strong>Pizzaria:</strong> {pzName(detailDrawer.pizzaria_id)}</p>
                <p><strong>Período:</strong> {detailDrawer.periodo_inicio} a {detailDrawer.periodo_fim}</p>
                <p><strong>Status:</strong> {statusBadge(detailDrawer.status)}</p>
                {detailDrawer.data_pagamento && <p><strong>Pago em:</strong> {format(new Date(detailDrawer.data_pagamento), "dd/MM/yyyy")}</p>}
                {detailDrawer.observacao && <p className="text-muted-foreground italic text-xs">{detailDrawer.observacao}</p>}
              </div>
              <div className="space-y-1 bg-secondary rounded-lg p-3">
                <p>Delivery: {fmt(Number(detailDrawer.total_delivery))} × {detailDrawer.taxa_delivery_aplicada}%</p>
                <p>Retirada: {fmt(Number(detailDrawer.total_retirada))} × {detailDrawer.taxa_retirada_aplicada}%</p>
                <p>Salão: {fmt(Number(detailDrawer.total_local))} × {detailDrawer.taxa_local_aplicada}%</p>
                <p className="pt-2 text-muted-foreground">Já retido automaticamente: {fmt(Number(detailDrawer.valor_automatico_pp))}</p>
                <p className="font-bold text-primary pt-1">Valor devido: {fmt(Number(detailDrawer.valor_total_devido))}</p>
              </div>
              {detailDrawer.boleto_url && (
                <div className="space-y-2">
                  <p className="font-medium">Boleto Asaas</p>
                  <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                    <a href={detailDrawer.boleto_url} target="_blank" rel="noopener noreferrer">
                      Abrir boleto
                    </a>
                  </Button>
                </div>
              )}
              <div>
                <p className="font-medium mb-2">Pedidos incluídos ({Array.isArray(detailDrawer.pedidos_snapshot) ? detailDrawer.pedidos_snapshot.length : 0}):</p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {Array.isArray(detailDrawer.pedidos_snapshot) && detailDrawer.pedidos_snapshot.map((id: string, i: number) => (
                    <p key={id} className="text-xs text-muted-foreground font-mono">{i + 1}. {id.slice(0, 8)}…</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}

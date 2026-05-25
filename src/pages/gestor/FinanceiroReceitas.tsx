import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import { Store, DollarSign, TrendingUp, Download, FileSpreadsheet, FileText, BarChart2, List, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import TablePagination from "@/components/gestor/TablePagination";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter, drawSectionTitle } from "@/lib/pdf-helpers";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  format, startOfDay, endOfDay, subDays, subMonths, subWeeks,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
} from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

type QuickPeriod = "campanha" | "hoje" | "ontem" | "esta_semana" | "semana_passada" | "este_mes" | "mes_passado" | "3m" | "6m" | "custom";
const QUICK_LABELS: Record<Exclude<QuickPeriod, "custom">, string> = {
  campanha: "Toda a campanha", hoje: "Hoje", ontem: "Ontem",
  esta_semana: "Esta semana", semana_passada: "Semana passada",
  este_mes: "Este mês", mes_passado: "Mês passado",
  "3m": "Últimos 3 meses", "6m": "Últimos 6 meses",
};
function getQuickRange(p: Exclude<QuickPeriod, "campanha" | "custom">): [Date, Date] {
  const now = new Date();
  switch (p) {
    case "hoje": return [startOfDay(now), endOfDay(now)];
    case "ontem": return [startOfDay(subDays(now, 1)), endOfDay(subDays(now, 1))];
    case "esta_semana": return [startOfWeek(now, { weekStartsOn: 1 }), endOfDay(now)];
    case "semana_passada": { const s = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }); return [s, endOfWeek(s, { weekStartsOn: 1 })]; }
    case "este_mes": return [startOfMonth(now), endOfDay(now)];
    case "mes_passado": return [startOfMonth(subMonths(now, 1)), endOfMonth(subMonths(now, 1))];
    case "3m": return [startOfDay(subMonths(now, 3)), endOfDay(now)];
    case "6m": return [startOfDay(subMonths(now, 6)), endOfDay(now)];
  }
}

interface ContextType { selectedCampanha: string; filterSlot: HTMLDivElement | null; exportSlot: HTMLDivElement | null; }

export default function FinanceiroReceitas() {
  const { selectedCampanha, filterSlot, exportSlot } = useOutletContext<ContextType>();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pizzarias, setPizzarias] = useState<any[]>([]);
  const [selectedPizzaria, setSelectedPizzaria] = useState("todas");
  const [comissao, setComissao] = useState(15);
  const [loading, setLoading] = useState(true);

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [quick, setQuick] = useState<QuickPeriod>("campanha");
  const [dateFrom, setDateFrom] = useState<Date>(() => startOfDay(subDays(new Date(), 29)));
  const [dateTo, setDateTo] = useState<Date>(() => endOfDay(new Date()));
  const [customFromStr, setCustomFromStr] = useState("");
  const [customToStr, setCustomToStr] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ periodo: false });
  const toggleSection = (k: string) => setOpenSections(s => ({ ...s, [k]: !s[k] }));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let campId = selectedCampanha;
      if (campId === "todas") {
        const { data: cp } = await supabase.from("campanhas").select("id, percentual_comissao").eq("is_principal", true).limit(1).single();
        setComissao(Number(cp?.percentual_comissao ?? 15));
      } else {
        const { data: cp } = await supabase.from("campanhas").select("percentual_comissao").eq("id", campId).single();
        setComissao(Number(cp?.percentual_comissao ?? 15));
      }
      let pQ = supabase.from("pedidos").select("valor_total, data_pedido, pizzaria_id, campanha_id, consumidor_id").eq("status", "entregue");
      if (selectedCampanha !== "todas") pQ = pQ.eq("campanha_id", selectedCampanha);
      const [{ data: p }, { data: pz }, { data: validConsumers }] = await Promise.all([
        pQ,
        supabase.from("pizzarias").select("id, nome, cidade, data_entrada"),
        supabase.from("consumidores").select("id, usuarios(nome, telefone)"),
      ]);
      const validIds = new Set((validConsumers ?? []).filter((c: any) => c.usuarios?.nome && c.usuarios?.telefone).map((c: any) => c.id));
      setPedidos((p ?? []).filter((ped: any) => validIds.has(ped.consumidor_id)));
      setPizzarias(pz ?? []);
      setLoading(false);
    };
    fetchData();
  }, [selectedCampanha]);

  const filtered = useMemo(() => {
    let list = pedidos;
    if (quick !== "campanha") list = list.filter(p => { const d = new Date(p.data_pedido); return d >= dateFrom && d <= dateTo; });
    if (selectedPizzaria !== "todas") list = list.filter(p => p.pizzaria_id === selectedPizzaria);
    return list;
  }, [pedidos, selectedPizzaria, quick, dateFrom, dateTo]);

  const hasActiveFilters = quick !== "campanha";
  const activeFilterCount = [quick !== "campanha"].filter(Boolean).length;
  const clearFilters = () => { setQuick("campanha"); setCustomFromStr(""); setCustomToStr(""); };

  const pctDecimal = comissao / 100;

  const stats = useMemo(() => {
    const totalVendas = filtered.reduce((s, p) => s + Number(p.valor_total), 0);
    const totalComissoes = totalVendas * pctDecimal;
    const totalCiclo = totalComissoes;
    const receitaMedia = pizzarias.length > 0 ? totalCiclo / pizzarias.length : 0;
    return { totalVendas, totalComissoes, totalCiclo, receitaMedia };
  }, [filtered, pizzarias, pctDecimal]);

  const porPizzaria = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(p => { map[p.pizzaria_id] = (map[p.pizzaria_id] || 0) + Number(p.valor_total); });
    return pizzarias.map(pz => {
      const vendido = map[pz.id] || 0;
      const comissaoVal = vendido * pctDecimal;
      return { id: pz.id, nome: pz.nome, cidade: pz.cidade, entrada: pz.data_entrada, vendido, comissao: comissaoVal, totalPP: comissaoVal, pctTotal: stats.totalCiclo > 0 ? (comissaoVal / stats.totalCiclo) * 100 : 0 };
    }).sort((a, b) => b.totalPP - a.totalPP);
  }, [filtered, pizzarias, stats.totalCiclo, pctDecimal]);

  const chartData = porPizzaria.slice(0, 15).map(p => ({ nome: p.nome.length > 12 ? p.nome.slice(0, 12) + "…" : p.nome, receita: p.comissao }));

  const mensal = useMemo(() => {
    const byMonth: Record<string, { vendas: number; pizzarias: Set<string> }> = {};
    filtered.forEach(p => {
      const m = new Date(p.data_pedido).toISOString().slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { vendas: 0, pizzarias: new Set() };
      byMonth[m].vendas += Number(p.valor_total);
      byMonth[m].pizzarias.add(p.pizzaria_id);
    });
    return Object.entries(byMonth).sort().map(([mes, d]) => ({
      mes: mes.split("-").reverse().join("/"),
      pizzariasAtivas: d.pizzarias.size,
      totalVendido: d.vendas,
      comissoes: d.vendas * pctDecimal,
      totalPP: d.vendas * pctDecimal,
    }));
  }, [filtered, pctDecimal]);

  const pagedPizzaria = pageSize === 0 ? porPizzaria : porPizzaria.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const today = format(new Date(), "yyyy-MM-dd");
  const filterLines: string[] = [];
  if (selectedPizzaria !== "todas") filterLines.push(`Pizzaria: ${pizzarias.find(p => p.id === selectedPizzaria)?.nome ?? selectedPizzaria}`);
  if (quick !== "campanha") filterLines.push(`Período: ${quick === "custom" ? `${customFromStr} a ${customToStr}` : QUICK_LABELS[quick as Exclude<QuickPeriod, "custom">]}`);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const hPz = ["Pizzaria", "Cidade", "Total Vendido", `Comissão PP (${comissao}%)`, "Total PP", "% do Total"];
    const rowsPz = porPizzaria.map(r => [r.nome, r.cidade, fmt(r.vendido), fmt(r.comissao), fmt(r.totalPP), fmtPct(r.pctTotal)]);
    const ws1 = XLSX.utils.aoa_to_sheet([hPz, ...rowsPz]);
    ws1["!cols"] = hPz.map((h, i) => ({ wch: Math.min(Math.max(h.length, ...rowsPz.map(r => String(r[i]).length)) + 2, 50) }));
    XLSX.utils.book_append_sheet(wb, ws1, "Por Pizzaria");
    const hMs = ["Mês", "Pizzarias Ativas", "Total Vendido", "Comissões", "Total PP"];
    const rowsMs = mensal.map(r => [r.mes, r.pizzariasAtivas, fmt(r.totalVendido), fmt(r.comissoes), fmt(r.totalPP)]);
    const ws2 = XLSX.utils.aoa_to_sheet([hMs, ...rowsMs]);
    XLSX.utils.book_append_sheet(wb, ws2, "Receita Mensal");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
    const a = document.createElement("a"); a.href = url; a.download = `financeiro-receitas-${today}.xlsx`; a.click(); URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const header = ["Pizzaria", "Cidade", "Total Vendido", `Comissão PP (${comissao}%)`, "Total PP", "% do Total"].join(",");
    const rows = porPizzaria.map(r => [r.nome, r.cidade, fmt(r.vendido), fmt(r.comissao), fmt(r.totalPP), fmtPct(r.pctTotal)].map(v => typeof v === "string" && v.includes(",") ? `"${v}"` : v).join(","));
    const csv = [header, ...rows].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `financeiro-receitas-${today}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportSinteticoPDF = async () => {
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    let y = buildPdfHeader(doc, "Receitas", "Relatório Sintético", filterLines, lettering);

    y = drawSectionTitle(doc, "KPIs", y);
    autoTable(doc, { ...TABLE_STYLES, head: [["Indicador", "Valor"]], body: [["Total Comissões", fmt(stats.totalComissoes)], ["Total do Ciclo", fmt(stats.totalCiclo)], ["Receita Média / Pizzaria", fmt(stats.receitaMedia)]], startY: y, tableWidth: 280 });
    y = (doc as any).lastAutoTable.finalY + 16;

    y = drawSectionTitle(doc, "Top 10 Pizzarias", y);
    autoTable(doc, { ...TABLE_STYLES, head: [["Pizzaria", "Cidade", "Total Vendido", `Comissão PP (${comissao}%)`, "% do Total"]], body: porPizzaria.slice(0, 10).map(r => [r.nome, r.cidade, fmt(r.vendido), fmt(r.comissao), fmtPct(r.pctTotal)]), startY: y });
    addPdfFooter(doc, "Receitas — Sintético");
    doc.save(`financeiro-receitas-sintetico-${today}.pdf`);
  };

  const exportAnaliticoPDF = async () => {
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    let y = buildPdfHeader(doc, "Receitas", "Relatório Analítico — Por Pizzaria", filterLines, lettering);
    autoTable(doc, { ...TABLE_STYLES, head: [["Pizzaria", "Cidade", "Total Vendido", `Comissão PP (${comissao}%)`, "Total PP", "% do Total", "Entrada"]], body: porPizzaria.map(r => [r.nome, r.cidade, fmt(r.vendido), fmt(r.comissao), fmt(r.totalPP), fmtPct(r.pctTotal), r.entrada ?? ""]), startY: y });
    addPdfFooter(doc, "Receitas — Analítico");
    doc.save(`financeiro-receitas-analitico-${today}.pdf`);
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {filterSlot && createPortal(
        <>
          <Select value={selectedPizzaria} onValueChange={setSelectedPizzaria}>
            <SelectTrigger className="w-[200px] h-8 text-sm"><SelectValue placeholder="Pizzaria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as pizzarias</SelectItem>
              {pizzarias.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>

          <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <PopoverTrigger asChild>
              <Button variant={hasActiveFilters ? "default" : "outline"} size="sm" className="h-8 text-xs gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Avançado
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-white/25 text-[10px] font-semibold px-1.5 leading-4">{activeFilterCount}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 overflow-x-hidden" align="start" style={{ maxHeight: "540px", overflowY: "auto" }}>
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <span className="text-sm font-semibold">Filtros avançados</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => { clearFilters(); setAdvancedOpen(false); }}>Limpar tudo</Button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-border">
                <div>
                  <button onClick={() => toggleSection("periodo")} className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Período</span>
                      {quick !== "campanha" && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections.periodo ? "rotate-180" : ""}`} />
                  </button>
                  {openSections.periodo && (
                    <div className="px-5 pt-1 pb-5 space-y-2">
                      <div className="flex flex-wrap gap-1 overflow-hidden">
                        {(Object.keys(QUICK_LABELS) as Exclude<QuickPeriod, "custom">[]).map(p => (
                          <Button key={p} variant={quick === p ? "default" : "outline"} size="sm" className="text-xs h-6 px-2"
                            onClick={() => {
                              if (p === "campanha") { setQuick("campanha"); } else {
                                const [f, t] = getQuickRange(p as Exclude<QuickPeriod, "campanha" | "custom">);
                                setQuick(p); setDateFrom(f); setDateTo(t);
                              }
                            }}>
                            {QUICK_LABELS[p]}
                          </Button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input type="date" value={customFromStr} onChange={e => setCustomFromStr(e.target.value)} className="w-full min-w-0 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                        <input type="date" value={customToStr} onChange={e => setCustomToStr(e.target.value)} className="w-full min-w-0 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring" />
                      </div>
                      <Button size="sm" className="w-full text-xs h-7" disabled={!customFromStr || !customToStr}
                        onClick={() => { setQuick("custom"); setDateFrom(startOfDay(new Date(customFromStr))); setDateTo(endOfDay(new Date(customToStr))); }}>
                        Aplicar período personalizado
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

        </>,
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><DollarSign className="h-5 w-5 text-success" /><CardTitle className="text-sm text-muted-foreground">Total Comissões ({comissao}%)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold text-success">{fmt(stats.totalComissoes)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><TrendingUp className="h-5 w-5 text-primary" /><CardTitle className="text-sm text-muted-foreground">Total do Ciclo</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold text-primary">{fmt(stats.totalCiclo)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><Store className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-sm text-muted-foreground">Receita Média / Pizzaria</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold">{fmt(stats.receitaMedia)}</p></CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="font-heading">Receita por Pizzaria</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 60, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="receita" name="Comissão PP" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading">Detalhamento por Pizzaria</CardTitle>
          <TablePagination total={porPizzaria.length} pageSize={pageSize} currentPage={currentPage} onPageSizeChange={setPageSize} onPageChange={setCurrentPage} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pizzaria</TableHead><TableHead>Cidade</TableHead>
                <TableHead className="text-right">Total Vendido</TableHead><TableHead className="text-right">Comissão PP ({comissao}%)</TableHead>
                <TableHead className="text-right">Total PP</TableHead>
                <TableHead className="text-right">% do Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedPizzaria.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell>{r.cidade}</TableCell>
                  <TableCell className="text-right">{fmt(r.vendido)}</TableCell>
                  <TableCell className="text-right">{fmt(r.comissao)}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(r.totalPP)}</TableCell>
                  <TableCell className="text-right">{fmtPct(r.pctTotal)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-bold">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right">{fmt(stats.totalVendas)}</TableCell>
                <TableCell className="text-right">{fmt(stats.totalComissoes)}</TableCell>
                <TableCell className="text-right">{fmt(stats.totalCiclo)}</TableCell>
                <TableCell className="text-right">100%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="font-heading">Receita Mensal</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead><TableHead className="text-right">Pizzarias Ativas</TableHead>
                <TableHead className="text-right">Total Vendido</TableHead><TableHead className="text-right">Comissões</TableHead>
                <TableHead className="text-right">Total PP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mensal.map(r => (
                <TableRow key={r.mes}>
                  <TableCell>{r.mes}</TableCell>
                  <TableCell className="text-right">{r.pizzariasAtivas}</TableCell>
                  <TableCell className="text-right">{fmt(r.totalVendido)}</TableCell>
                  <TableCell className="text-right">{fmt(r.comissoes)}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(r.totalPP)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

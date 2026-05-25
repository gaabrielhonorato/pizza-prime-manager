import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import { ArrowRightLeft, CheckCircle, Clock, AlertCircle, Download, FileSpreadsheet, FileText, BarChart2, List, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TablePagination from "@/components/gestor/TablePagination";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter, drawSectionTitle } from "@/lib/pdf-helpers";
import {
  format, startOfDay, endOfDay, subDays, subMonths, subWeeks,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
} from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

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

interface ContextType { selectedCampanha: string; actionSlot: HTMLDivElement | null; }

const statusBadge = (s: string) => {
  if (s === "pago") return <Badge className="bg-success text-success-foreground">Pago</Badge>;
  if (s === "processando") return <Badge className="bg-amber-500 text-white">Processando</Badge>;
  return <Badge variant="secondary">Pendente</Badge>;
};

const statusLabel = (s: string) => s === "pago" ? "Pago" : s === "processando" ? "Processando" : "Pendente";

export default function FinanceiroRepasses() {
  const { selectedCampanha, actionSlot } = useOutletContext<ContextType>();
  const [repasses, setRepasses] = useState<any[]>([]);
  const [pizzarias, setPizzarias] = useState<any[]>([]);
  const [comissao, setComissao] = useState(15);
  const [selectedPizzaria, setSelectedPizzaria] = useState("todas");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payObs, setPayObs] = useState("");

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [quick, setQuick] = useState<QuickPeriod>("campanha");
  const [dateFrom, setDateFrom] = useState<Date>(() => startOfDay(subDays(new Date(), 29)));
  const [dateTo, setDateTo] = useState<Date>(() => endOfDay(new Date()));
  const [customFromStr, setCustomFromStr] = useState("");
  const [customToStr, setCustomToStr] = useState("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ periodo: false, valor: false });
  const toggleSection = (k: string) => setOpenSections(s => ({ ...s, [k]: !s[k] }));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const campQ = selectedCampanha === "todas"
        ? supabase.from("campanhas").select("percentual_comissao").eq("is_principal", true).limit(1).single()
        : supabase.from("campanhas").select("percentual_comissao").eq("id", selectedCampanha).single();
      let rQ = supabase.from("repasses").select("*");
      if (selectedCampanha !== "todas") rQ = rQ.eq("campanha_id", selectedCampanha);
      const [{ data: cp }, { data: r }, { data: pz }] = await Promise.all([
        campQ,
        rQ.order("periodo_inicio", { ascending: false }),
        supabase.from("pizzarias").select("id, nome"),
      ]);
      setComissao(Number(cp?.percentual_comissao ?? 15));
      setRepasses(r ?? []);
      setPizzarias(pz ?? []);
      setLoading(false);
    };
    fetchData();
  }, [selectedCampanha]);

  const pzName = (id: string) => pizzarias.find(p => p.id === id)?.nome ?? "—";

  const filtered = useMemo(() => {
    let r = repasses;
    if (selectedPizzaria !== "todas") r = r.filter(x => x.pizzaria_id === selectedPizzaria);
    if (statusFilter !== "todos") r = r.filter(x => x.status === statusFilter);
    if (quick !== "campanha") r = r.filter(x => {
      const d = new Date(x.periodo_inicio);
      return d >= dateFrom && d <= dateTo;
    });
    if (valorMin !== "") r = r.filter(x => Number(x.valor_repasse) >= parseFloat(valorMin));
    if (valorMax !== "") r = r.filter(x => Number(x.valor_repasse) <= parseFloat(valorMax));
    return r;
  }, [repasses, selectedPizzaria, statusFilter, quick, dateFrom, dateTo, valorMin, valorMax]);

  const hasActiveFilters = quick !== "campanha" || valorMin !== "" || valorMax !== "";
  const activeFilterCount = [quick !== "campanha", valorMin !== "" || valorMax !== ""].filter(Boolean).length;
  const clearFilters = () => { setQuick("campanha"); setCustomFromStr(""); setCustomToStr(""); setValorMin(""); setValorMax(""); };

  const stats = useMemo(() => {
    const total = repasses.reduce((s, r) => s + Number(r.valor_repasse), 0);
    const pago = repasses.filter(r => r.status === "pago").reduce((s, r) => s + Number(r.valor_repasse), 0);
    const pendente = total - pago;
    return { total, pago, pendente };
  }, [repasses]);

  const pagedRepasses = pageSize === 0 ? filtered : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const markPaid = async () => {
    if (!payModal) return;
    const { error } = await supabase.from("repasses").update({ status: "pago", data_pagamento: payDate }).eq("id", payModal);
    if (error) { toast.error("Erro ao atualizar."); return; }
    setRepasses(prev => prev.map(r => r.id === payModal ? { ...r, status: "pago", data_pagamento: payDate } : r));
    setPayModal(null);
    toast.success("Repasse marcado como pago!");
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const filterLines: string[] = [];
  if (selectedPizzaria !== "todas") filterLines.push(`Pizzaria: ${pzName(selectedPizzaria)}`);
  if (statusFilter !== "todos") filterLines.push(`Status: ${statusLabel(statusFilter)}`);
  if (quick !== "campanha") filterLines.push(`Período: ${quick === "custom" ? `${customFromStr} a ${customToStr}` : QUICK_LABELS[quick as Exclude<QuickPeriod, "custom">]}`);
  if (valorMin !== "" || valorMax !== "") filterLines.push(`Valor repasse: ${valorMin || "0"} – ${valorMax || "∞"}`);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const header = ["Pizzaria", "Período", "Total Vendido", `Repasse (${100 - comissao}%)`, "Status", "Data Pagamento"];
    const rows = filtered.map(r => [pzName(r.pizzaria_id), `${r.periodo_inicio} a ${r.periodo_fim}`, fmt(Number(r.valor_bruto)), fmt(Number(r.valor_repasse)), statusLabel(r.status), r.data_pagamento ? new Date(r.data_pagamento).toLocaleDateString("pt-BR") : "—"]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = header.map((h, i) => ({ wch: Math.min(Math.max(h.length, ...rows.map(r => String(r[i]).length)) + 2, 50) }));
    XLSX.utils.book_append_sheet(wb, ws, "Repasses");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
    const a = document.createElement("a"); a.href = url; a.download = `financeiro-repasses-${today}.xlsx`; a.click(); URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const header = ["Pizzaria", "Período", "Total Vendido", `Repasse (${100 - comissao}%)`, "Status", "Data Pagamento"].join(",");
    const rows = filtered.map(r => [pzName(r.pizzaria_id), `${r.periodo_inicio} a ${r.periodo_fim}`, fmt(Number(r.valor_bruto)), fmt(Number(r.valor_repasse)), statusLabel(r.status), r.data_pagamento ? new Date(r.data_pagamento).toLocaleDateString("pt-BR") : "—"].map(v => typeof v === "string" && v.includes(",") ? `"${v}"` : v).join(","));
    const csv = [header, ...rows].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `financeiro-repasses-${today}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportSinteticoPDF = async () => {
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
    let y = buildPdfHeader(doc, "Repasses", "Relatório Sintético", filterLines, lettering);
    y = drawSectionTitle(doc, "KPIs", y);
    autoTable(doc, { ...TABLE_STYLES, head: [["Indicador", "Valor"]], body: [["Total a Repassar", fmt(stats.total)], ["Já Repassado", fmt(stats.pago)], ["Pendente", fmt(stats.pendente)]], startY: y, tableWidth: 280 });
    y = (doc as any).lastAutoTable.finalY + 16;
    y = drawSectionTitle(doc, "Resumo por Status", y);
    const byStatus = [["pendente", "Pendente"], ["processando", "Processando"], ["pago", "Pago"]].map(([s, l]) => {
      const items = repasses.filter(r => r.status === s);
      return [l, items.length, fmt(items.reduce((sum, r) => sum + Number(r.valor_repasse), 0))];
    });
    autoTable(doc, { ...TABLE_STYLES, head: [["Status", "Qtd.", "Total"]], body: byStatus, startY: y });
    addPdfFooter(doc, "Repasses — Sintético");
    doc.save(`financeiro-repasses-sintetico-${today}.pdf`);
  };

  const exportAnaliticoPDF = async () => {
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    let y = buildPdfHeader(doc, "Repasses", "Relatório Analítico — Todos os Repasses", filterLines, lettering);
    autoTable(doc, { ...TABLE_STYLES, head: [["Pizzaria", "Período", "Total Vendido", `Repasse (${100 - comissao}%)`, "Status", "Data Pagamento"]], body: filtered.map(r => [pzName(r.pizzaria_id), `${r.periodo_inicio} a ${r.periodo_fim}`, fmt(Number(r.valor_bruto)), fmt(Number(r.valor_repasse)), statusLabel(r.status), r.data_pagamento ? new Date(r.data_pagamento).toLocaleDateString("pt-BR") : "—"]), startY: y });
    addPdfFooter(doc, "Repasses — Analítico");
    doc.save(`financeiro-repasses-analitico-${today}.pdf`);
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {actionSlot && createPortal(
        <>
          <Select value={selectedPizzaria} onValueChange={setSelectedPizzaria}>
            <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas pizzarias</SelectItem>
              {pizzarias.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="processando">Processando</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
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
                {/* Período */}
                <div>
                  <button onClick={() => toggleSection("periodo")} className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Período do repasse</span>
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

                {/* Valor repasse */}
                <div>
                  <button onClick={() => toggleSection("valor")} className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Valor do repasse</span>
                      {(valorMin !== "" || valorMax !== "") && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections.valor ? "rotate-180" : ""}`} />
                  </button>
                  {openSections.valor && (
                    <div className="px-5 pt-1 pb-5 space-y-2">
                      <p className="text-xs text-muted-foreground">Filtrar pelo valor do repasse (R$)</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground">Mínimo</p>
                          <Input type="number" min="0" step="0.01" placeholder="0,00" value={valorMin} onChange={e => setValorMin(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground">Máximo</p>
                          <Input type="number" min="0" step="0.01" placeholder="∞" value={valorMax} onChange={e => setValorMax(e.target.value)} className="h-8 text-xs" />
                        </div>
                      </div>
                      {(valorMin !== "" || valorMax !== "") && (
                        <Button variant="ghost" size="sm" className="text-xs h-6 px-2 w-full" onClick={() => { setValorMin(""); setValorMax(""); }}>Limpar valor</Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

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
        </>,
        actionSlot,
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><ArrowRightLeft className="h-5 w-5 text-primary" /><CardTitle className="text-sm text-muted-foreground">Total a Repassar</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold">{fmt(stats.total)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><CheckCircle className="h-5 w-5 text-success" /><CardTitle className="text-sm text-muted-foreground">Já Repassado</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold text-success">{fmt(stats.pago)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><Clock className="h-5 w-5 text-amber-500" /><CardTitle className="text-sm text-muted-foreground">Pendente</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold text-amber-500">{fmt(stats.pendente)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><AlertCircle className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-sm text-muted-foreground">Próximo Repasse</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-heading font-bold">—</p></CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading">Repasses por Pizzaria</CardTitle>
          <TablePagination total={filtered.length} pageSize={pageSize} currentPage={currentPage} onPageSizeChange={setPageSize} onPageChange={setCurrentPage} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pizzaria</TableHead><TableHead>Período</TableHead>
                <TableHead className="text-right">Total Vendido</TableHead><TableHead className="text-right">Repasse ({100 - comissao}%)</TableHead>
                <TableHead>Status</TableHead><TableHead>Data Pagamento</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">Nenhum repasse encontrado.</TableCell></TableRow>
              ) : pagedRepasses.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{pzName(r.pizzaria_id)}</TableCell>
                  <TableCell className="text-sm">{r.periodo_inicio} a {r.periodo_fim}</TableCell>
                  <TableCell className="text-right">{fmt(Number(r.valor_bruto))}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(Number(r.valor_repasse))}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>{r.data_pagamento ? new Date(r.data_pagamento).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.status !== "pago" && (
                      <Button size="sm" variant="outline" onClick={() => { setPayModal(r.id); setPayDate(new Date().toISOString().slice(0, 10)); setPayObs(""); }}>
                        Marcar como pago
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!payModal} onOpenChange={o => !o && setPayModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Pago</DialogTitle>
            <DialogDescription>Informe a data do pagamento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Data do Pagamento</Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea value={payObs} onChange={e => setPayObs(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayModal(null)}>Cancelar</Button>
            <Button onClick={markPaid}>Confirmar Pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

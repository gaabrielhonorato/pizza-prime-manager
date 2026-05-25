import { useMemo, useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { ArrowRightLeft, CheckCircle, Clock, AlertCircle, Download, FileSpreadsheet, FileText, BarChart2, List } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TablePagination from "@/components/gestor/TablePagination";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter, drawSectionTitle } from "@/lib/pdf-helpers";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

interface ContextType { selectedCampanha: string; periodo: string; }

const statusBadge = (s: string) => {
  if (s === "pago") return <Badge className="bg-success text-success-foreground">Pago</Badge>;
  if (s === "processando") return <Badge className="bg-amber-500 text-white">Processando</Badge>;
  return <Badge variant="secondary">Pendente</Badge>;
};

const statusLabel = (s: string) => s === "pago" ? "Pago" : s === "processando" ? "Processando" : "Pendente";

export default function FinanceiroRepasses() {
  const { selectedCampanha } = useOutletContext<ContextType>();
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
    return r;
  }, [repasses, selectedPizzaria, statusFilter]);

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
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Repasses</h1>
        <div className="flex items-center gap-3">
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
      </div>

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

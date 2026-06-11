import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarDays, Download, FileSpreadsheet, FileText, BarChart2, List } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter, drawSectionTitle } from "@/lib/pdf-helpers";
import { format, addDays, subDays, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

interface ContextType { selectedCampanha: string; filterSlot: HTMLDivElement | null; exportSlot: HTMLDivElement | null; }

export default function FinanceiroDiario() {
  const { selectedCampanha, exportSlot } = useOutletContext<ContextType>();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pizzarias, setPizzarias] = useState<any[]>([]);
  const [campanha, setCampanha] = useState<any>(null);
  const [filterPizzaria, setFilterPizzaria] = useState("todas");
  const [loading, setLoading] = useState(true);

  const dateObj = new Date(date + "T12:00:00");
  const dateLabel = isToday(dateObj) ? "Hoje" : isYesterday(dateObj) ? "Ontem" : format(dateObj, "dd/MM/yyyy");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let campId = selectedCampanha;
      if (campId === "todas") {
        const { data: cp } = await supabase.from("campanhas").select("*").eq("is_principal", true).limit(1).single();
        campId = cp?.id ?? "";
        setCampanha(cp);
      } else {
        const { data: cp } = await supabase.from("campanhas").select("*").eq("id", campId).single();
        setCampanha(cp);
      }
      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59`;
      let q = supabase.from("pedidos").select("*").eq("status", "entregue").gte("data_pedido", dayStart).lte("data_pedido", dayEnd);
      if (selectedCampanha !== "todas") q = q.eq("campanha_id", selectedCampanha);
      const [{ data: p }, { data: pz }, { data: validConsumers }] = await Promise.all([
        q,
        supabase.from("pizzarias").select("id, nome"),
        supabase.from("consumidores").select("id, usuarios(nome, telefone)"),
      ]);
      const validIds = new Set((validConsumers ?? []).filter((c: any) => c.usuarios?.nome && c.usuarios?.telefone).map((c: any) => c.id));
      setPedidos((p ?? []).filter((ped: any) => validIds.has(ped.consumidor_id)));
      setPizzarias(pz ?? []);
      setLoading(false);
    };
    fetchData();
  }, [date, selectedCampanha]);

  const taxaDel = campanha?.taxa_delivery ?? 15;
  const taxaRet = campanha?.taxa_retirada ?? 15;
  const taxaLoc = campanha?.taxa_local ?? 12;

  const getTaxa = (tipo: string | null) => {
    if (tipo === "retirada") return taxaRet;
    if (tipo === "local") return taxaLoc;
    return taxaDel;
  };

  const tableData = useMemo(() => {
    const filtered = filterPizzaria === "todas" ? pedidos : pedidos.filter(p => p.pizzaria_id === filterPizzaria);
    const byPz: Record<string, { delivery: any[]; retirada: any[]; local: any[] }> = {};
    filtered.forEach(p => {
      if (!byPz[p.pizzaria_id]) byPz[p.pizzaria_id] = { delivery: [], retirada: [], local: [] };
      const tipo = p.tipo_pedido === "retirada" ? "retirada" : p.tipo_pedido === "local" ? "local" : "delivery";
      byPz[p.pizzaria_id][tipo].push(p);
    });
    return Object.entries(byPz).map(([pzId, types]) => {
      const delTotal = types.delivery.reduce((s, p) => s + Number(p.valor_total), 0);
      const retTotal = types.retirada.reduce((s, p) => s + Number(p.valor_total), 0);
      const locTotal = types.local.reduce((s, p) => s + Number(p.valor_total), 0);
      const delPP = delTotal * taxaDel / 100;
      const retPP = retTotal * taxaRet / 100;
      const locPP = locTotal * taxaLoc / 100;
      const totalDia = delTotal + retTotal + locTotal;
      const totalPP = delPP + retPP + locPP;
      const autoSplit = types.delivery.filter(p => p.canal === "cardapioweb").reduce((s, p) => s + Number(p.valor_total), 0) * taxaDel / 100
        + types.retirada.filter(p => p.canal === "cardapioweb").reduce((s, p) => s + Number(p.valor_total), 0) * taxaRet / 100
        + types.local.filter(p => p.canal === "cardapioweb").reduce((s, p) => s + Number(p.valor_total), 0) * taxaLoc / 100;
      return {
        pizzariaId: pzId, nome: pizzarias.find(z => z.id === pzId)?.nome ?? "—",
        delQtd: types.delivery.length, delTotal, delTaxa: taxaDel, delPP,
        retQtd: types.retirada.length, retTotal, retTaxa: taxaRet, retPP,
        locQtd: types.local.length, locTotal, locTaxa: taxaLoc, locPP,
        totalDia, totalPP, autoSplit, pendManual: totalPP - autoSplit,
      };
    });
  }, [pedidos, pizzarias, filterPizzaria, taxaDel, taxaRet, taxaLoc]);

  const totals = useMemo(() => tableData.reduce((acc, r) => ({
    totalVendido: acc.totalVendido + r.totalDia,
    totalPP: acc.totalPP + r.totalPP,
    totalPizzarias: acc.totalPizzarias + (r.totalDia - r.totalPP),
    autoSplit: acc.autoSplit + r.autoSplit,
    pendManual: acc.pendManual + r.pendManual,
    pedidos: acc.pedidos + r.delQtd + r.retQtd + r.locQtd,
  }), { totalVendido: 0, totalPP: 0, totalPizzarias: 0, autoSplit: 0, pendManual: 0, pedidos: 0 }), [tableData]);

  const autoCount = pedidos.filter(p => p.canal === "cardapioweb").length;
  const manualCount = pedidos.length - autoCount;
  const today = format(new Date(), "yyyy-MM-dd");
  const filterLines = [`Data: ${dateLabel}`, ...(filterPizzaria !== "todas" ? [`Pizzaria: ${pizzarias.find(p => p.id === filterPizzaria)?.nome ?? filterPizzaria}`] : [])];

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const header = ["Pizzaria", "Del. Qtd", "Del. Vendido", "Del. Taxa", "Del. PP", "Ret. Qtd", "Ret. Vendido", "Ret. Taxa", "Ret. PP", "Salão Qtd", "Salão Vendido", "Salão Taxa", "Salão PP", "Total Dia", "Split Auto", "Pend. Manual"];
    const rows = tableData.map(r => [r.nome, r.delQtd, fmt(r.delTotal), `${r.delTaxa}%`, fmt(r.delPP), r.retQtd, fmt(r.retTotal), `${r.retTaxa}%`, fmt(r.retPP), r.locQtd, fmt(r.locTotal), `${r.locTaxa}%`, fmt(r.locPP), fmt(r.totalDia), fmt(r.autoSplit), fmt(r.pendManual)]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = header.map((h, i) => ({ wch: Math.min(Math.max(h.length, ...rows.map(r => String(r[i]).length)) + 2, 50) }));
    XLSX.utils.book_append_sheet(wb, ws, "Diário");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
    const a = document.createElement("a"); a.href = url; a.download = `diario-${date}.xlsx`; a.click(); URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const header = ["Pizzaria", "Total Vendido", "Total PP", "Split Auto", "Pend. Manual"].join(",");
    const rows = tableData.map(r => [r.nome, fmt(r.totalDia), fmt(r.totalPP), fmt(r.autoSplit), fmt(r.pendManual)].map(v => typeof v === "string" && v.includes(",") ? `"${v}"` : v).join(","));
    const csv = [header, ...rows].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `diario-${date}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportSinteticoPDF = async () => {
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    let y = buildPdfHeader(doc, "Relatório Diário", `Data: ${dateLabel}`, filterLines, lettering);
    y = drawSectionTitle(doc, "Resumo do Dia", y);
    autoTable(doc, { ...TABLE_STYLES, head: [["Indicador", "Valor"]], body: [["Total Vendido", fmt(totals.totalVendido)], ["Total PP", fmt(totals.totalPP)], ["Total Pizzarias", fmt(totals.totalPizzarias)], ["Split Automático", fmt(totals.autoSplit)], ["Pendente Manual", fmt(totals.pendManual)], ["Pedidos Automáticos", `${autoCount}`], ["Pedidos Manuais", `${manualCount}`]], startY: y, tableWidth: 280 });
    y = (doc as any).lastAutoTable.finalY + 16;
    y = drawSectionTitle(doc, "Por Pizzaria", y);
    autoTable(doc, { ...TABLE_STYLES, head: [["Pizzaria", "Total Vendido", "Total PP", "Split Auto", "Pend. Manual"]], body: tableData.map(r => [r.nome, fmt(r.totalDia), fmt(r.totalPP), fmt(r.autoSplit), fmt(r.pendManual)]), startY: y });
    addPdfFooter(doc, "Relatório Diário — Sintético");
    doc.save(`diario-sintetico-${date}.pdf`);
  };

  const exportAnaliticoPDF = async () => {
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    let y = buildPdfHeader(doc, "Relatório Diário", `Analítico — ${dateLabel}`, filterLines, lettering);
    autoTable(doc, { ...TABLE_STYLES, head: [["Pizzaria", "Del Qtd", "Del Vendido", "Del PP", "Ret Qtd", "Ret Vendido", "Ret PP", "Sal Qtd", "Sal Vendido", "Sal PP", "Total", "Auto", "Manual"]], body: tableData.map(r => [r.nome, r.delQtd, fmt(r.delTotal), fmt(r.delPP), r.retQtd, fmt(r.retTotal), fmt(r.retPP), r.locQtd, fmt(r.locTotal), fmt(r.locPP), fmt(r.totalDia), fmt(r.autoSplit), fmt(r.pendManual)]), startY: y });
    addPdfFooter(doc, "Relatório Diário — Analítico");
    doc.save(`diario-analitico-${date}.pdf`);
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
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

      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setDate(subDays(dateObj, 1).toISOString().slice(0, 10))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-[160px] h-8 text-sm" />
          <span className="text-sm font-medium text-muted-foreground">{dateLabel}</span>
        </div>
        <Button variant="outline" size="icon" onClick={() => setDate(addDays(dateObj, 1).toISOString().slice(0, 10))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Select value={filterPizzaria} onValueChange={setFilterPizzaria}>
          <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas pizzarias</SelectItem>
            {pizzarias.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-border bg-card"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total vendido</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold">{fmt(totals.totalVendido)}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total PP</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold text-primary">{fmt(totals.totalPP)}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total pizzarias</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold">{fmt(totals.totalPizzarias)}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Automáticos</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold">{autoCount} pedidos</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Manuais</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold">{manualCount} pedidos</p></CardContent></Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="font-heading">Detalhamento por Pizzaria</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {tableData.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Nenhum pedido neste dia.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2} className="align-bottom">Pizzaria</TableHead>
                  <TableHead colSpan={4} className="text-center border-l border-border">Delivery</TableHead>
                  <TableHead colSpan={4} className="text-center border-l border-border">Retirada</TableHead>
                  <TableHead colSpan={4} className="text-center border-l border-border">Salão</TableHead>
                  <TableHead className="text-right border-l border-border">Total</TableHead>
                  <TableHead className="text-right">Split Auto</TableHead>
                  <TableHead className="text-right">Pend. Manual</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="text-right border-l border-border text-xs">Qtd</TableHead>
                  <TableHead className="text-right text-xs">Vendido</TableHead>
                  <TableHead className="text-right text-xs">Taxa</TableHead>
                  <TableHead className="text-right text-xs">PP</TableHead>
                  <TableHead className="text-right border-l border-border text-xs">Qtd</TableHead>
                  <TableHead className="text-right text-xs">Vendido</TableHead>
                  <TableHead className="text-right text-xs">Taxa</TableHead>
                  <TableHead className="text-right text-xs">PP</TableHead>
                  <TableHead className="text-right border-l border-border text-xs">Qtd</TableHead>
                  <TableHead className="text-right text-xs">Vendido</TableHead>
                  <TableHead className="text-right text-xs">Taxa</TableHead>
                  <TableHead className="text-right text-xs">PP</TableHead>
                  <TableHead className="border-l border-border" />
                  <TableHead />
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map(r => (
                  <TableRow key={r.pizzariaId}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right border-l border-border">{r.delQtd}</TableCell>
                    <TableCell className="text-right">{fmt(r.delTotal)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.delTaxa}%</TableCell>
                    <TableCell className="text-right">{fmt(r.delPP)}</TableCell>
                    <TableCell className="text-right border-l border-border">{r.retQtd}</TableCell>
                    <TableCell className="text-right">{fmt(r.retTotal)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.retTaxa}%</TableCell>
                    <TableCell className="text-right">{fmt(r.retPP)}</TableCell>
                    <TableCell className="text-right border-l border-border">{r.locQtd}</TableCell>
                    <TableCell className="text-right">{fmt(r.locTotal)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.locTaxa}%</TableCell>
                    <TableCell className="text-right">{fmt(r.locPP)}</TableCell>
                    <TableCell className="text-right font-medium border-l border-border">{fmt(r.totalDia)}</TableCell>
                    <TableCell className="text-right">{fmt(r.autoSplit)}</TableCell>
                    <TableCell className="text-right font-medium text-amber-500">{fmt(r.pendManual)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right border-l border-border">{tableData.reduce((s, r) => s + r.delQtd, 0)}</TableCell>
                  <TableCell className="text-right">{fmt(tableData.reduce((s, r) => s + r.delTotal, 0))}</TableCell>
                  <TableCell />
                  <TableCell className="text-right">{fmt(tableData.reduce((s, r) => s + r.delPP, 0))}</TableCell>
                  <TableCell className="text-right border-l border-border">{tableData.reduce((s, r) => s + r.retQtd, 0)}</TableCell>
                  <TableCell className="text-right">{fmt(tableData.reduce((s, r) => s + r.retTotal, 0))}</TableCell>
                  <TableCell />
                  <TableCell className="text-right">{fmt(tableData.reduce((s, r) => s + r.retPP, 0))}</TableCell>
                  <TableCell className="text-right border-l border-border">{tableData.reduce((s, r) => s + r.locQtd, 0)}</TableCell>
                  <TableCell className="text-right">{fmt(tableData.reduce((s, r) => s + r.locTotal, 0))}</TableCell>
                  <TableCell />
                  <TableCell className="text-right">{fmt(tableData.reduce((s, r) => s + r.locPP, 0))}</TableCell>
                  <TableCell className="text-right border-l border-border">{fmt(totals.totalVendido)}</TableCell>
                  <TableCell className="text-right">{fmt(totals.autoSplit)}</TableCell>
                  <TableCell className="text-right text-amber-500">{fmt(totals.pendManual)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

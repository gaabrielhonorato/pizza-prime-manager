import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, Clock, CreditCard, Download, BarChart2, List, FileSpreadsheet, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useMinhaPizzaria } from "@/contexts/MinhaPizzariaContext";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter } from "@/lib/pdf-helpers";
import TablePagination from "@/components/gestor/TablePagination";

function statusBadge(s: string) {
  const lower = s.toLowerCase();
  const cls = lower === "pago"
    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    : lower === "processando"
    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
    : "bg-muted text-muted-foreground border-border";
  return <Badge variant="outline" className={cls}>{s}</Badge>;
}

interface RepasseRow {
  id: string;
  periodoInicio: string;
  periodoFim: string;
  valorBruto: number;
  percentual: number;
  valorPizzaPremiada: number;
  valorRepasse: number;
  dataPagamento: string | null;
  status: string;
}

export default function PizzariaFinanceiro() {
  const { pizzaria } = useMinhaPizzaria();
  const [repasses, setRepasses] = useState<RepasseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumoPage, setResumoPage] = useState(1);
  const [resumoPageSize, setResumoPageSize] = useState(10);
  const [histPage, setHistPage] = useState(1);
  const [histPageSize, setHistPageSize] = useState(10);

  useEffect(() => {
    if (!pizzaria) return;
    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("repasses")
        .select("*")
        .eq("pizzaria_id", pizzaria.id)
        .order("periodo_inicio", { ascending: false });

      if (error) {
        console.error("Error fetching repasses:", error);
        setLoading(false);
        return;
      }

      setRepasses((data ?? []).map((r: any) => ({
        id: r.id,
        periodoInicio: r.periodo_inicio,
        periodoFim: r.periodo_fim,
        valorBruto: Number(r.valor_bruto),
        percentual: Number(r.percentual_pizza_premiada),
        valorPizzaPremiada: Number(r.valor_pizza_premiada),
        valorRepasse: Number(r.valor_repasse),
        dataPagamento: r.data_pagamento,
        status: r.status,
      })));
      setLoading(false);
    };
    fetchData();
  }, [pizzaria]);

  const totalVendido = repasses.reduce((s, r) => s + r.valorBruto, 0);
  const totalRepasses = repasses.filter(r => r.status === "pago").reduce((s, r) => s + r.valorRepasse, 0);
  const pendente = repasses.find(r => r.status === "processando" || r.status === "pendente");
  const ultimoPago = repasses.find(r => r.status === "pago");
  const proximoRepasse = ultimoPago
    ? format(addMonths(new Date(ultimoPago.periodoFim), 1), "dd/MM/yyyy")
    : "—";

  const kpis = [
    { label: "Total vendido", value: `R$ ${totalVendido.toLocaleString("pt-BR")}`, icon: DollarSign },
    { label: "Repasses recebidos", value: `R$ ${totalRepasses.toLocaleString("pt-BR")}`, icon: TrendingUp },
    { label: "Próximo repasse previsto", value: proximoRepasse, icon: Clock },
    { label: "Repasse pendente", value: `R$ ${(pendente?.valorRepasse ?? 0).toLocaleString("pt-BR")}`, icon: CreditCard },
  ];

  const formatPeriodo = (inicio: string, fim: string) => {
    try {
      return format(new Date(inicio), "MMMM/yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());
    } catch {
      return `${inicio} - ${fim}`;
    }
  };

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

  const pagados = repasses.filter(r => r.status === "pago");
  const resumoSlice = resumoPageSize === 0 ? repasses : repasses.slice((resumoPage - 1) * resumoPageSize, resumoPage * resumoPageSize);
  const histSlice = histPageSize === 0 ? pagados : pagados.slice((histPage - 1) * histPageSize, histPage * histPageSize);

  async function exportSinteticoPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const lettering = await loadLetteringDataUrl();
    let y = buildPdfHeader(doc, "Financeiro — Relatório Sintético", pizzaria?.nome ?? "", [], lettering);

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

    const byStatus: Record<string, { count: number; total: number }> = {};
    repasses.forEach(r => {
      if (!byStatus[r.status]) byStatus[r.status] = { count: 0, total: 0 };
      byStatus[r.status].count++;
      byStatus[r.status].total += r.valorRepasse;
    });

    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.slate900);
    doc.text("Resumo por Status", 20, y); y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Status", "Qtd", "Total Repasse"]],
      body: Object.entries(byStatus).map(([s, v]) => [s, String(v.count), fmt(v.total)]),
      ...TABLE_STYLES,
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.slate900);
    doc.text("Repasses por Período", 20, y); y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Período", "Total Vendas", "% PP", "Repasse", "Status"]],
      body: repasses.map(r => [
        formatPeriodo(r.periodoInicio, r.periodoFim),
        fmt(r.valorBruto),
        `${r.percentual.toFixed(1)}%`,
        fmt(r.valorRepasse),
        r.status,
      ]),
      ...TABLE_STYLES,
    });

    addPdfFooter(doc, "Financeiro — Relatório Sintético");
    doc.save(`financeiro-sintetico-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.pdf`);
  }

  async function exportAnaliticoPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const lettering = await loadLetteringDataUrl();
    const y = buildPdfHeader(doc, "Financeiro — Relatório Analítico", pizzaria?.nome ?? "", [], lettering);

    autoTable(doc, {
      startY: y,
      head: [["Período", "Data Pgto", "Total Vendas", "% PP", "Valor PP", "Repasse Líquido", "Status"]],
      body: repasses.map(r => [
        formatPeriodo(r.periodoInicio, r.periodoFim),
        r.dataPagamento ? format(new Date(r.dataPagamento), "dd/MM/yyyy") : "—",
        fmt(r.valorBruto),
        `${r.percentual.toFixed(1)}%`,
        fmt(r.valorPizzaPremiada),
        fmt(r.valorRepasse),
        r.status,
      ]),
      ...TABLE_STYLES,
    });

    addPdfFooter(doc, "Financeiro — Relatório Analítico");
    doc.save(`financeiro-analitico-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.pdf`);
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(repasses.map(r => ({
      "Período": formatPeriodo(r.periodoInicio, r.periodoFim),
      "Data Pagamento": r.dataPagamento ? format(new Date(r.dataPagamento), "dd/MM/yyyy") : "",
      "Total Vendido (R$)": r.valorBruto,
      "% PP": r.percentual,
      "Valor PP (R$)": r.valorPizzaPremiada,
      "Repasse Líquido (R$)": r.valorRepasse,
      "Status": r.status,
    })));
    XLSX.utils.book_append_sheet(wb, ws, "Repasses");
    XLSX.writeFile(wb, `financeiro-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.xlsx`);
  }

  function exportCSV() {
    const header = "Período,Data Pagamento,Total Vendido,% PP,Valor PP,Repasse Líquido,Status";
    const rows = repasses.map(r =>
      [
        `"${formatPeriodo(r.periodoInicio, r.periodoFim)}"`,
        r.dataPagamento ? format(new Date(r.dataPagamento), "dd/MM/yyyy") : "",
        r.valorBruto,
        r.percentual,
        r.valorPizzaPremiada,
        r.valorRepasse,
        r.status,
      ].join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${pizzaria?.nome?.toLowerCase().replace(/\s+/g, "-") ?? "pizzaria"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe vendas, repasses e histórico financeiro.</p>
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

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando dados financeiros...</div>
      ) : (
        <Tabs defaultValue="resumo" className="space-y-4">
          <TabsList className="bg-secondary">
            <TabsTrigger value="resumo" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Resumo</TabsTrigger>
            <TabsTrigger value="historico" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Histórico de Repasses</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="space-y-6">
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
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Repasses</CardTitle>
                <TablePagination
                  total={repasses.length}
                  pageSize={resumoPageSize}
                  currentPage={resumoPage}
                  onPageSizeChange={setResumoPageSize}
                  onPageChange={setResumoPage}
                />
              </CardHeader>
              <CardContent className="p-0">
                {repasses.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">Nenhum repasse registrado ainda.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Total de Vendas</TableHead>
                        <TableHead className="text-right">% Pizza Premiada</TableHead>
                        <TableHead className="text-right">Repasse</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resumoSlice.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{formatPeriodo(r.periodoInicio, r.periodoFim)}</TableCell>
                          <TableCell className="text-right">R$ {r.valorBruto.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right text-muted-foreground">R$ {r.valorPizzaPremiada.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right font-medium">R$ {r.valorRepasse.toLocaleString("pt-BR")}</TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Histórico de Repasses</CardTitle>
                <TablePagination
                  total={pagados.length}
                  pageSize={histPageSize}
                  currentPage={histPage}
                  onPageSizeChange={setHistPageSize}
                  onPageChange={setHistPage}
                />
              </CardHeader>
              <CardContent className="p-0">
                {pagados.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">Nenhum repasse pago ainda.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data Pgto</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Valor Bruto</TableHead>
                        <TableHead className="text-right">Valor Líquido</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {histSlice.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{r.dataPagamento ? format(new Date(r.dataPagamento), "dd/MM/yyyy") : "—"}</TableCell>
                          <TableCell className="text-xs">{formatPeriodo(r.periodoInicio, r.periodoFim)}</TableCell>
                          <TableCell className="text-right">R$ {r.valorBruto.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right font-medium">R$ {r.valorRepasse.toLocaleString("pt-BR")}</TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

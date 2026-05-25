import { useMemo, useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Store, DollarSign, TrendingUp, Download, FileSpreadsheet, FileText, BarChart2, List } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import TablePagination from "@/components/gestor/TablePagination";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter, drawSectionTitle } from "@/lib/pdf-helpers";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

interface ContextType { selectedCampanha: string; periodo: string; }

export default function FinanceiroReceitas() {
  const { selectedCampanha } = useOutletContext<ContextType>();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pizzarias, setPizzarias] = useState<any[]>([]);
  const [selectedPizzaria, setSelectedPizzaria] = useState("todas");
  const [comissao, setComissao] = useState(15);
  const [loading, setLoading] = useState(true);

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

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
    if (selectedPizzaria === "todas") return pedidos;
    return pedidos.filter(p => p.pizzaria_id === selectedPizzaria);
  }, [pedidos, selectedPizzaria]);

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
  const filterLines = selectedPizzaria !== "todas" ? [`Pizzaria: ${pizzarias.find(p => p.id === selectedPizzaria)?.nome ?? selectedPizzaria}`] : [];

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
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Receitas</h1>
        <div className="flex items-center gap-3">
          <Select value={selectedPizzaria} onValueChange={setSelectedPizzaria}>
            <SelectTrigger className="w-[200px] h-8 text-sm"><SelectValue placeholder="Pizzaria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as pizzarias</SelectItem>
              {pizzarias.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
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
              <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nome" width={80} className="text-xs" />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="receita" name="Comissão PP" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
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

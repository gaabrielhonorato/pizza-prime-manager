import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import { Wallet, Plus, Pencil, Trash2, TrendingDown, Download, FileSpreadsheet, FileText, BarChart2, List, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TablePagination from "@/components/gestor/TablePagination";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter, drawSectionTitle } from "@/lib/pdf-helpers";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const CATEGORIAS = [
  { value: "operacional_mensal", label: "Operacional Mensal", color: "bg-blue-500" },
  { value: "variavel", label: "Variável", color: "bg-amber-500" },
  { value: "diluido_vendas", label: "Diluído nas Vendas", color: "bg-purple-500" },
];
const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(217, 91%, 60%)"];

interface ContextType { selectedCampanha: string; filterSlot: HTMLDivElement | null; exportSlot: HTMLDivElement | null; }

const emptyForm = { descricao: "", categoria: "", valor: "", meses: "", observacao: "" };

export default function FinanceiroCustos() {
  const { selectedCampanha, filterSlot, exportSlot } = useOutletContext<ContextType>();
  const [custos, setCustos] = useState<any[]>([]);
  const [faturamento, setFaturamento] = useState(0);
  const [campanhaId, setCampanhaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState("todas");

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [buscaFilter, setBuscaFilter] = useState("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ busca: false, valor: false });
  const toggleSection = (k: string) => setOpenSections(s => ({ ...s, [k]: !s[k] }));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let campId = selectedCampanha;
      if (campId === "todas") {
        const { data: cp } = await supabase.from("campanhas").select("id").eq("is_principal", true).limit(1).single();
        campId = cp?.id ?? "";
      }
      setCampanhaId(campId);
      let pQ = supabase.from("pedidos").select("valor_total, consumidor_id").eq("status", "entregue");
      if (selectedCampanha !== "todas") pQ = pQ.eq("campanha_id", selectedCampanha);
      const [{ data: ped }, { data: validConsumers }] = await Promise.all([
        pQ,
        supabase.from("consumidores").select("id, usuarios(nome, telefone)"),
      ]);
      const validIds = new Set((validConsumers ?? []).filter((c: any) => c.usuarios?.nome && c.usuarios?.telefone).map((c: any) => c.id));
      const pedFiltrados = (ped ?? []).filter((p: any) => validIds.has(p.consumidor_id));
      setFaturamento(pedFiltrados.reduce((s: number, p: any) => s + Number(p.valor_total), 0));
      let cQ = supabase.from("custos_operacionais").select("*");
      if (selectedCampanha !== "todas") cQ = cQ.eq("campanha_id", selectedCampanha);
      const { data: c } = await cQ.order("criado_em", { ascending: false });
      setCustos(c ?? []);
      setLoading(false);
    };
    fetchData();
  }, [selectedCampanha]);

  const calcTotal = (c: any) => {
    if (c.categoria === "operacional_mensal") return Number(c.valor) * (c.meses_aplicados || 1);
    if (c.categoria === "variavel") return Number(c.valor);
    if (c.categoria === "diluido_vendas") return faturamento * (Number(c.valor) / 100);
    return Number(c.valor_total_calculado);
  };

  const filteredCustos = useMemo(() => {
    let list = catFilter === "todas" ? custos : custos.filter(c => c.categoria === catFilter);
    if (buscaFilter.trim()) {
      const q = buscaFilter.trim().toLowerCase();
      list = list.filter(c => c.descricao?.toLowerCase().includes(q));
    }
    if (valorMin !== "" || valorMax !== "") {
      list = list.filter(c => {
        const total = calcTotal(c);
        if (valorMin !== "" && total < parseFloat(valorMin)) return false;
        if (valorMax !== "" && total > parseFloat(valorMax)) return false;
        return true;
      });
    }
    return list;
  }, [custos, catFilter, buscaFilter, valorMin, valorMax, faturamento]);

  const hasActiveFilters = buscaFilter.trim() !== "" || valorMin !== "" || valorMax !== "";
  const activeFilterCount = [buscaFilter.trim() !== "", valorMin !== "" || valorMax !== ""].filter(Boolean).length;
  const clearFilters = () => { setBuscaFilter(""); setValorMin(""); setValorMax(""); };

  const stats = useMemo(() => {
    const opMensal = custos.filter(c => c.categoria === "operacional_mensal").reduce((s, c) => s + calcTotal(c), 0);
    const variaveis = custos.filter(c => c.categoria === "variavel").reduce((s, c) => s + calcTotal(c), 0);
    const diluidos = custos.filter(c => c.categoria === "diluido_vendas").reduce((s, c) => s + calcTotal(c), 0);
    return { opMensal, variaveis, diluidos, total: opMensal + variaveis + diluidos };
  }, [custos, faturamento]);

  const pieData = [
    { name: "Operacional Mensal", value: stats.opMensal },
    { name: "Variável", value: stats.variaveis },
    { name: "Diluído nas Vendas", value: stats.diluidos },
  ].filter(d => d.value > 0);

  const pagedCustos = pageSize === 0 ? filteredCustos : filteredCustos.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openNew = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({ descricao: c.descricao, categoria: c.categoria, valor: String(c.valor), meses: c.meses_aplicados ? String(c.meses_aplicados) : "", observacao: c.observacao || "" });
    setDialogOpen(true);
  };

  const save = async () => {
    const val = parseFloat(form.valor);
    if (!form.descricao || Number.isNaN(val) || !form.categoria) return;
    const meses = form.categoria === "operacional_mensal" ? parseInt(form.meses) || 1 : null;
    let totalCalc = val;
    if (form.categoria === "operacional_mensal") totalCalc = val * (meses || 1);
    if (form.categoria === "diluido_vendas") totalCalc = faturamento * (val / 100);
    const payload = { descricao: form.descricao, categoria: form.categoria, valor: val, meses_aplicados: meses, valor_total_calculado: totalCalc, observacao: form.observacao || null, campanha_id: campanhaId! };
    if (editingId) {
      const { error } = await supabase.from("custos_operacionais").update(payload).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar."); return; }
      setCustos(prev => prev.map(c => c.id === editingId ? { ...c, ...payload } : c));
    } else {
      const { data: n, error } = await supabase.from("custos_operacionais").insert(payload).select().single();
      if (error) { toast.error("Erro ao adicionar."); return; }
      setCustos(prev => [n, ...prev]);
    }
    setDialogOpen(false);
    toast.success(editingId ? "Custo atualizado!" : "Custo adicionado!");
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("custos_operacionais").delete().eq("id", deleteId);
    if (error) { toast.error("Erro ao excluir."); return; }
    setCustos(prev => prev.filter(c => c.id !== deleteId));
    setDeleteId(null);
    toast.success("Custo excluído!");
  };

  const catLabel = (cat: string) => CATEGORIAS.find(c => c.value === cat)?.label ?? cat;
  const catColor = (cat: string) => CATEGORIAS.find(c => c.value === cat)?.color ?? "bg-muted";
  const calcDesc = (c: any) => {
    if (c.categoria === "operacional_mensal") return `${fmt(Number(c.valor))} × ${c.meses_aplicados || 1} meses`;
    if (c.categoria === "variavel") return "Valor fixo";
    return `${Number(c.valor)}% do faturamento`;
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const filterLines: string[] = [];
  if (catFilter !== "todas") filterLines.push(`Categoria: ${catLabel(catFilter)}`);
  if (buscaFilter.trim()) filterLines.push(`Busca: "${buscaFilter}"`);
  if (valorMin !== "" || valorMax !== "") filterLines.push(`Valor: ${valorMin || "0"} – ${valorMax || "∞"}`);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const header = ["Descrição", "Categoria", "Valor Base", "Cálculo", "Total", "% Faturamento"];
    const rows = filteredCustos.map(c => {
      const total = calcTotal(c);
      return [c.descricao, catLabel(c.categoria), c.categoria === "diluido_vendas" ? `${Number(c.valor)}%` : fmt(Number(c.valor)), calcDesc(c), fmt(total), faturamento > 0 ? `${((total / faturamento) * 100).toFixed(1)}%` : "0%"];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = header.map((h, i) => ({ wch: Math.min(Math.max(h.length, ...rows.map(r => String(r[i]).length)) + 2, 50) }));
    XLSX.utils.book_append_sheet(wb, ws, "Custos");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
    const a = document.createElement("a"); a.href = url; a.download = `financeiro-custos-${today}.xlsx`; a.click(); URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const header = ["Descrição", "Categoria", "Valor Base", "Cálculo", "Total"].join(",");
    const rows = filteredCustos.map(c => [c.descricao, catLabel(c.categoria), c.categoria === "diluido_vendas" ? `${Number(c.valor)}%` : fmt(Number(c.valor)), calcDesc(c), fmt(calcTotal(c))].map(v => typeof v === "string" && v.includes(",") ? `"${v}"` : v).join(","));
    const csv = [header, ...rows].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `financeiro-custos-${today}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportSinteticoPDF = async () => {
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "portrait", unit: "pt" });
    let y = buildPdfHeader(doc, "Custos", "Relatório Sintético", filterLines, lettering);
    y = drawSectionTitle(doc, "KPIs", y);
    autoTable(doc, { ...TABLE_STYLES, head: [["Categoria", "Total"]], body: [["Total de Custos", fmt(stats.total)], ["Operacionais Mensais", fmt(stats.opMensal)], ["Custos Variáveis", fmt(stats.variaveis)], ["Diluídos nas Vendas", fmt(stats.diluidos)]], startY: y, tableWidth: 280 });
    y = (doc as any).lastAutoTable.finalY + 16;
    y = drawSectionTitle(doc, "Resumo por Categoria", y);
    autoTable(doc, { ...TABLE_STYLES, head: [["Categoria", "Qtd.", "Total", "% do Total"]], body: CATEGORIAS.map(cat => { const items = custos.filter(c => c.categoria === cat.value); const total = items.reduce((s, c) => s + calcTotal(c), 0); return [cat.label, items.length, fmt(total), stats.total > 0 ? `${((total / stats.total) * 100).toFixed(1)}%` : "0%"]; }), startY: y });
    addPdfFooter(doc, "Custos — Sintético");
    doc.save(`financeiro-custos-sintetico-${today}.pdf`);
  };

  const exportAnaliticoPDF = async () => {
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    let y = buildPdfHeader(doc, "Custos", "Relatório Analítico — Todos os Custos", filterLines, lettering);
    autoTable(doc, { ...TABLE_STYLES, head: [["Descrição", "Categoria", "Valor Base", "Cálculo", "Total Calculado"]], body: filteredCustos.map(c => [c.descricao, catLabel(c.categoria), c.categoria === "diluido_vendas" ? `${Number(c.valor)}%` : fmt(Number(c.valor)), calcDesc(c), fmt(calcTotal(c))]), startY: y });
    addPdfFooter(doc, "Custos — Analítico");
    doc.save(`financeiro-custos-analitico-${today}.pdf`);
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {filterSlot && createPortal(
        <>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-[200px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
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
                  <span className="text-xs text-muted-foreground">{filteredCustos.length} resultado{filteredCustos.length !== 1 ? "s" : ""}</span>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => { clearFilters(); setAdvancedOpen(false); }}>Limpar tudo</Button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-border">
                {/* Busca por descrição */}
                <div>
                  <button onClick={() => toggleSection("busca")} className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Busca por descrição</span>
                      {buscaFilter.trim() !== "" && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections.busca ? "rotate-180" : ""}`} />
                  </button>
                  {openSections.busca && (
                    <div className="px-5 pt-1 pb-5 space-y-2">
                      <Input
                        placeholder="Filtrar por descrição..."
                        value={buscaFilter}
                        onChange={e => setBuscaFilter(e.target.value)}
                        className="h-8 text-xs"
                      />
                      {buscaFilter && (
                        <Button variant="ghost" size="sm" className="text-xs h-6 px-2 w-full" onClick={() => setBuscaFilter("")}>Limpar busca</Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Valor total */}
                <div>
                  <button onClick={() => toggleSection("valor")} className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Valor total</span>
                      {(valorMin !== "" || valorMax !== "") && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openSections.valor ? "rotate-180" : ""}`} />
                  </button>
                  {openSections.valor && (
                    <div className="px-5 pt-1 pb-5 space-y-2">
                      <p className="text-xs text-muted-foreground">Filtrar por valor calculado (R$)</p>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><TrendingDown className="h-5 w-5 text-destructive" /><CardTitle className="text-sm text-muted-foreground">Total de Custos</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold text-destructive">{fmt(stats.total)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><Wallet className="h-5 w-5 text-blue-500" /><CardTitle className="text-sm text-muted-foreground">Operacionais Mensais</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold">{fmt(stats.opMensal)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><Wallet className="h-5 w-5 text-amber-500" /><CardTitle className="text-sm text-muted-foreground">Custos Variáveis</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold">{fmt(stats.variaveis)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><Wallet className="h-5 w-5 text-purple-500" /><CardTitle className="text-sm text-muted-foreground">Diluídos (% vendas)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold">{fmt(stats.diluidos)}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {pieData.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="font-heading">Distribuição por Categoria</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="font-heading">Resumo</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Custos operacionais mensais: <span className="font-bold">{fmt(stats.opMensal)}</span></p>
            <p>Custos variáveis: <span className="font-bold">{fmt(stats.variaveis)}</span></p>
            <p>Custos diluídos: <span className="font-bold">{fmt(stats.diluidos)}</span> <span className="text-muted-foreground">(atualiza em tempo real)</span></p>
            <hr className="border-border" />
            <p className="text-base font-bold">Total de custos: <span className="text-destructive">{fmt(stats.total)}</span></p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle className="font-heading">Custos Cadastrados</CardTitle>
            <TablePagination total={filteredCustos.length} pageSize={pageSize} currentPage={currentPage} onPageSizeChange={setPageSize} onPageChange={setCurrentPage} />
          </div>
          <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Adicionar Custo</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead><TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor Base</TableHead><TableHead>Cálculo</TableHead>
                <TableHead className="text-right">Total</TableHead><TableHead className="text-right">% Fat.</TableHead>
                <TableHead className="w-[90px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustos.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">Nenhum custo encontrado.</TableCell></TableRow>
              ) : pagedCustos.map(c => {
                const total = calcTotal(c);
                const pctFat = faturamento > 0 ? (total / faturamento) * 100 : 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell>{c.descricao}</TableCell>
                    <TableCell><Badge variant="secondary" className={`text-white ${catColor(c.categoria)}`}>{catLabel(c.categoria)}</Badge></TableCell>
                    <TableCell className="text-right">{c.categoria === "diluido_vendas" ? `${Number(c.valor)}%` : fmt(Number(c.valor))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{calcDesc(c)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(total)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{pctFat.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Custo" : "Adicionar Custo"}</DialogTitle>
            <DialogDescription>Preencha os dados do custo operacional.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Servidor mensal" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{form.categoria === "diluido_vendas" ? "Percentual (%)" : "Valor (R$)"}</Label>
                <Input type="number" min="0" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
              </div>
              {form.categoria === "operacional_mensal" && (
                <div className="space-y-2">
                  <Label>Nº de meses</Label>
                  <Input type="number" min="1" value={form.meses} onChange={e => setForm({ ...form, meses: e.target.value })} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editingId ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir custo?</AlertDialogTitle><AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

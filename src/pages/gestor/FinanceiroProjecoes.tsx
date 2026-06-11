import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import { Plus, Pencil, Trash2, Copy, Download, FileSpreadsheet, FileText, BarChart2, List } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TablePagination from "@/components/gestor/TablePagination";
import { C, TABLE_STYLES, loadLetteringDataUrl, buildPdfHeader, addPdfFooter, drawSectionTitle } from "@/lib/pdf-helpers";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

interface ContextType { selectedCampanha: string; filterSlot: HTMLDivElement | null; exportSlot: HTMLDivElement | null; }

interface Cenario {
  id: string;
  nome_cenario: string;
  cor_cenario: string;
  pizzarias_mes1: number;
  pizzarias_mes2: number;
  pizzarias_mes3: number;
  pizzarias_mes4: number;
  vendas_por_pizzaria_mes: number;
  ticket_medio: number;
  percentual_pp: number;
  valor_matricula: number;
  campanha_id: string;
}

const defaultForm: Omit<Cenario, "id" | "campanha_id"> = {
  nome_cenario: "", cor_cenario: "#F97316",
  pizzarias_mes1: 5, pizzarias_mes2: 8, pizzarias_mes3: 12, pizzarias_mes4: 15,
  vendas_por_pizzaria_mes: 100, ticket_medio: 55, percentual_pp: 15, valor_matricula: 0,
};

function calcProjecao(c: Omit<Cenario, "id" | "campanha_id">) {
  const meses = [
    { mes: "Mês 1", pz: c.pizzarias_mes1 },
    { mes: "Mês 2", pz: c.pizzarias_mes2 },
    { mes: "Mês 3", pz: c.pizzarias_mes3 },
    { mes: "Mês 4", pz: c.pizzarias_mes4 },
  ];
  let totalFat = 0, totalPP = 0, totalPiz = 0;
  const rows = meses.map((m) => {
    const vendas = m.pz * c.vendas_por_pizzaria_mes;
    const fat = vendas * c.ticket_medio;
    const pp = fat * (c.percentual_pp / 100);
    const piz = fat * ((100 - c.percentual_pp) / 100);
    totalFat += fat; totalPP += pp; totalPiz += piz;
    return { mes: m.mes, pizzarias: m.pz, vendas, fat, pp, piz, receitaPP: pp };
  });
  return { rows, totalFat, totalPP, totalPiz, totalMat: 0 };
}

export default function FinanceiroProjecoes() {
  const { selectedCampanha, filterSlot, exportSlot } = useOutletContext<ContextType>();
  const [cenarios, setCenarios] = useState<Cenario[]>([]);
  const [custosTotal, setCustosTotal] = useState(0);
  const [campanhaId, setCampanhaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let campId = selectedCampanha;
      if (campId === "todas") {
        const { data: cp } = await supabase.from("campanhas").select("id").eq("is_principal", true).limit(1).single();
        campId = cp?.id ?? "";
      }
      setCampanhaId(campId);
      let cQ = supabase.from("projecoes_vendas").select("*");
      if (selectedCampanha !== "todas") cQ = cQ.eq("campanha_id", selectedCampanha);
      const { data: c } = await cQ.order("criado_em");
      setCenarios((c ?? []) as Cenario[]);
      let coQ = supabase.from("custos_operacionais").select("valor_total_calculado, valor, categoria");
      if (selectedCampanha !== "todas") coQ = coQ.eq("campanha_id", selectedCampanha);
      const { data: co } = await coQ;
      const totalC = (co ?? []).reduce((s, x) => {
        if (x.categoria === "operacional_mensal") return s + Number(x.valor_total_calculado);
        if (x.categoria === "variavel") return s + Number(x.valor);
        return s + Number(x.valor_total_calculado);
      }, 0);
      setCustosTotal(totalC);
      setLoading(false);
    };
    fetchData();
  }, [selectedCampanha]);

  const preview = useMemo(() => calcProjecao(form), [form]);

  const chartData = cenarios.map(c => {
    const p = calcProjecao(c);
    const lucro = p.totalPP - custosTotal;
    return { nome: c.nome_cenario, receitaPP: p.totalPP, custos: custosTotal, lucro, cor: c.cor_cenario };
  });

  const comparativoData = cenarios.map(c => {
    const p = calcProjecao(c);
    const lucro = p.totalPP - custosTotal;
    const margem = p.totalPP > 0 ? (lucro / p.totalPP) * 100 : 0;
    return { id: c.id, nome: c.nome_cenario, fat: p.totalFat, pp: p.totalPP, custos: custosTotal, lucro, margem };
  });

  const pagedComparativo = pageSize === 0 ? comparativoData : comparativoData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openNew = () => { setEditingId(null); setForm(defaultForm); setDialogOpen(true); };
  const openEdit = (c: Cenario) => {
    setEditingId(c.id);
    setForm({ nome_cenario: c.nome_cenario, cor_cenario: c.cor_cenario, pizzarias_mes1: c.pizzarias_mes1, pizzarias_mes2: c.pizzarias_mes2, pizzarias_mes3: c.pizzarias_mes3, pizzarias_mes4: c.pizzarias_mes4, vendas_por_pizzaria_mes: c.vendas_por_pizzaria_mes, ticket_medio: c.ticket_medio, percentual_pp: c.percentual_pp, valor_matricula: c.valor_matricula });
    setDialogOpen(true);
  };
  const duplicate = (c: Cenario) => { setEditingId(null); setForm({ ...c, nome_cenario: `${c.nome_cenario} (cópia)` }); setDialogOpen(true); };

  const save = async () => {
    if (!form.nome_cenario || !campanhaId) return;
    const payload = { ...form, campanha_id: campanhaId, atualizado_em: new Date().toISOString() };
    if (editingId) {
      const { error } = await supabase.from("projecoes_vendas").update(payload).eq("id", editingId);
      if (error) { toast.error(`Erro ao atualizar: ${error.message}`); return; }
      setCenarios(prev => prev.map(c => c.id === editingId ? { ...c, ...payload } : c));
    } else {
      const { data: n, error } = await supabase.from("projecoes_vendas").insert(payload).select().single();
      if (error) { toast.error(`Erro ao criar: ${error.message}`); return; }
      setCenarios(prev => [...prev, n as Cenario]);
    }
    setDialogOpen(false);
    toast.success(editingId ? "Cenário atualizado!" : "Cenário criado!");
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("projecoes_vendas").delete().eq("id", deleteId);
    if (error) { toast.error(`Erro ao excluir: ${error.message}`); return; }
    setCenarios(prev => prev.filter(c => c.id !== deleteId));
    setDeleteId(null);
    toast.success("Cenário excluído!");
  };

  const setField = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const today = format(new Date(), "yyyy-MM-dd");

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const h1 = ["Cenário", "Fat. Projetado", "Receita PP", "Custos", "Lucro", "Margem %"];
    const r1 = comparativoData.map(r => [r.nome, fmt(r.fat), fmt(r.pp), fmt(r.custos), fmt(r.lucro), fmtPct(r.margem)]);
    const ws1 = XLSX.utils.aoa_to_sheet([h1, ...r1]);
    XLSX.utils.book_append_sheet(wb, ws1, "Comparativo");
    cenarios.forEach(c => {
      const p = calcProjecao(c);
      const h = ["Mês", "Pizzarias", "Vendas", "Faturamento", "Receita PP", "Fat. Pizzarias"];
      const rows = p.rows.map(r => [r.mes, r.pizzarias, r.vendas, fmt(r.fat), fmt(r.receitaPP), fmt(r.piz)]);
      const ws = XLSX.utils.aoa_to_sheet([h, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, c.nome_cenario.substring(0, 31));
    });
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const url = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
    const a = document.createElement("a"); a.href = url; a.download = `financeiro-projecoes-${today}.xlsx`; a.click(); URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const header = ["Cenário", "Fat. Projetado", "Receita PP", "Custos", "Lucro", "Margem %"].join(",");
    const rows = comparativoData.map(r => [r.nome, fmt(r.fat), fmt(r.pp), fmt(r.custos), fmt(r.lucro), fmtPct(r.margem)].map(v => typeof v === "string" && v.includes(",") ? `"${v}"` : v).join(","));
    const csv = [header, ...rows].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `financeiro-projecoes-${today}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportSinteticoPDF = async () => {
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    let y = buildPdfHeader(doc, "Projeções", "Relatório Sintético — Comparativo de Cenários", [], lettering);
    autoTable(doc, { ...TABLE_STYLES, head: [["Cenário", "Fat. Projetado", "Receita PP", "Custos", "Lucro", "Margem %"]], body: comparativoData.map(r => [r.nome, fmt(r.fat), fmt(r.pp), fmt(r.custos), fmt(r.lucro), fmtPct(r.margem)]), startY: y });
    addPdfFooter(doc, "Projeções — Sintético");
    doc.save(`financeiro-projecoes-sintetico-${today}.pdf`);
  };

  const exportAnaliticoPDF = async () => {
    const lettering = await loadLetteringDataUrl();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    let y = buildPdfHeader(doc, "Projeções", "Relatório Analítico — Mês a Mês por Cenário", [], lettering);
    for (const c of cenarios) {
      const p = calcProjecao(c);
      y = drawSectionTitle(doc, c.nome_cenario, y);
      autoTable(doc, { ...TABLE_STYLES, head: [["Mês", "Pizzarias", "Vendas", "Faturamento", "Receita PP", "Fat. Pizzarias"]], body: p.rows.map(r => [r.mes, r.pizzarias, r.vendas, fmt(r.fat), fmt(r.receitaPP), fmt(r.piz)]), startY: y });
      y = (doc as any).lastAutoTable.finalY + 20;
      if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = 40; }
    }
    addPdfFooter(doc, "Projeções — Analítico");
    doc.save(`financeiro-projecoes-analitico-${today}.pdf`);
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {filterSlot && createPortal(
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo Cenário</Button>,
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

      {cenarios.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cenarios.map(c => {
            const p = calcProjecao(c);
            const lucro = p.totalPP - custosTotal;
            return (
              <Card key={c.id} className="border-border bg-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.cor_cenario }} />
                    <CardTitle className="text-base font-heading">{c.nome_cenario}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>Pizzarias: {c.pizzarias_mes1} → {c.pizzarias_mes4}</p>
                  <p>Ticket médio: {fmt(c.ticket_medio)}</p>
                  <p>Faturamento projetado: <span className="font-bold">{fmt(p.totalFat)}</span></p>
                  <p>Receita PP: <span className="font-bold text-primary">{fmt(p.totalPP)}</span></p>
                  <p>Lucro projetado: <span className={`font-bold ${lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmt(lucro)}</span></p>
                  <div className="flex gap-1 pt-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicate(c)}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {chartData.length > 1 && (
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="font-heading">Comparação de Cenários</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="nome" className="text-xs" />
                <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar animationDuration={1000} animationEasing="ease-in-out" dataKey="receitaPP" name="Receita PP" fill="hsl(var(--primary))"/>
                <Bar animationDuration={1000} animationEasing="ease-in-out" dataKey="custos" name="Custos" fill="hsl(var(--destructive))"/>
                <Bar animationDuration={1000} animationEasing="ease-in-out" dataKey="lucro" name="Lucro" fill="hsl(var(--success))"/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {comparativoData.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading">Tabela Comparativa</CardTitle>
            <TablePagination total={comparativoData.length} pageSize={pageSize} currentPage={currentPage} onPageSizeChange={setPageSize} onPageChange={setCurrentPage} />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cenário</TableHead>
                  <TableHead className="text-right">Fat. Projetado</TableHead>
                  <TableHead className="text-right">Receita PP</TableHead>
                  <TableHead className="text-right">Custos</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Margem %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedComparativo.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right">{fmt(r.fat)}</TableCell>
                    <TableCell className="text-right text-primary font-medium">{fmt(r.pp)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(r.custos)}</TableCell>
                    <TableCell className={`text-right font-medium ${r.lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmt(r.lucro)}</TableCell>
                    <TableCell className={`text-right ${r.margem >= 0 ? "text-success" : "text-destructive"}`}>{fmtPct(r.margem)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Cenário" : "Novo Cenário"}</DialogTitle>
            <DialogDescription>Configure os parâmetros da projeção.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do cenário</Label>
                <Input value={form.nome_cenario} onChange={e => setField("nome_cenario", e.target.value)} placeholder="Ex: Realista" />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input type="color" value={form.cor_cenario} onChange={e => setField("cor_cenario", e.target.value)} className="h-10 w-20" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(m => (
                <div key={m} className="space-y-2">
                  <Label>Pizzarias Mês {m}</Label>
                  <Input type="number" min="0" value={(form as any)[`pizzarias_mes${m}`]} onChange={e => setField(`pizzarias_mes${m}`, parseInt(e.target.value) || 0)} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendas / pizzaria / mês</Label>
                <Input type="number" min="0" value={form.vendas_por_pizzaria_mes} onChange={e => setField("vendas_por_pizzaria_mes", parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Ticket médio (R$)</Label>
                <Input type="number" min="0" step="0.01" value={form.ticket_medio} onChange={e => setField("ticket_medio", parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>% Pizza Premiada</Label>
                <Input type="number" min="0" max="100" value={form.percentual_pp} onChange={e => setField("percentual_pp", parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <Card className="border-border bg-muted/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Projeção Calculada</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead><TableHead className="text-right">Pizzarias</TableHead>
                      <TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Faturamento</TableHead>
                      <TableHead className="text-right">Fat. PP</TableHead>
                      <TableHead className="text-right">Receita PP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map(r => (
                      <TableRow key={r.mes}>
                        <TableCell>{r.mes}</TableCell>
                        <TableCell className="text-right">{r.pizzarias}</TableCell>
                        <TableCell className="text-right">{r.vendas}</TableCell>
                        <TableCell className="text-right">{fmt(r.fat)}</TableCell>
                        <TableCell className="text-right">{fmt(r.pp)}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(r.receitaPP)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 font-bold">
                      <TableCell colSpan={3}>Total do Ciclo</TableCell>
                      <TableCell className="text-right">{fmt(preview.totalFat)}</TableCell>
                      <TableCell className="text-right">{fmt(preview.totalPP)}</TableCell>
                      <TableCell className="text-right">{fmt(preview.totalPP)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="text-center"><p className="text-xs text-muted-foreground">Fat. Projetado</p><p className="font-bold">{fmt(preview.totalFat)}</p></div>
                  <div className="text-center"><p className="text-xs text-muted-foreground">Receita PP</p><p className="font-bold text-primary">{fmt(preview.totalPP)}</p></div>
                  <div className="text-center"><p className="text-xs text-muted-foreground">Custos</p><p className="font-bold text-destructive">{fmt(custosTotal)}</p></div>
                  <div className="text-center"><p className="text-xs text-muted-foreground">Lucro</p><p className={`font-bold ${preview.totalPP - custosTotal >= 0 ? "text-success" : "text-destructive"}`}>{fmt(preview.totalPP - custosTotal)}</p></div>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editingId ? "Salvar" : "Criar Cenário"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir cenário?</AlertDialogTitle><AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

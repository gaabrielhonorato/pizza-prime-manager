import { useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  pizzarias, premios, VALOR_MATRICULA, VENDAS_ESTIMADAS_CICLO,
  PERCENTUAL_VENDAS, PERCENTUAL_ANUNCIOS, CUSTO_CARDAPIO_WEB,
  CUSTO_CAPTACAO, CUSTO_EMBALAGEM_UNIDADE, TOTAL_EMBALAGENS_ESTIMADO,
} from "@/data/mockData";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const CATEGORIAS = ["Prêmios", "Anúncios", "CardápioWeb", "Captação", "Embalagens", "Outros"] as const;
type Categoria = (typeof CATEGORIAS)[number];

interface CustoItem {
  id: string;
  descricao: string;
  valor: number;
  categoria: Categoria;
  data: string;
}

function buildInitialCustos(): CustoItem[] {
  const ativas = pizzarias.filter((p) => p.status === "Ativa").length;
  const matriculasPagas = pizzarias.filter((p) => p.matriculaPaga).length;
  const receitaMatriculas = matriculasPagas * VALOR_MATRICULA;
  const receitaVendas = VENDAS_ESTIMADAS_CICLO * PERCENTUAL_VENDAS;
  const totalReceitas = receitaMatriculas + receitaVendas;

  return [
    { id: "fix-1", descricao: `Prêmios (1º + 2º + 3º)`, valor: premios.reduce((s, p) => s + p.valor, 0), categoria: "Prêmios", data: "2025-01-10" },
    { id: "fix-2", descricao: `Anúncios (30% do faturamento)`, valor: totalReceitas * PERCENTUAL_ANUNCIOS, categoria: "Anúncios", data: "2025-01-10" },
    { id: "fix-3", descricao: `CardápioWeb (${ativas} pizzarias × R$ ${CUSTO_CARDAPIO_WEB})`, valor: ativas * CUSTO_CARDAPIO_WEB, categoria: "CardápioWeb", data: "2025-01-10" },
    { id: "fix-4", descricao: `Captação`, valor: CUSTO_CAPTACAO, categoria: "Captação", data: "2025-01-10" },
    { id: "fix-5", descricao: `Embalagens (${TOTAL_EMBALAGENS_ESTIMADO.toLocaleString("pt-BR")} × R$ ${CUSTO_EMBALAGEM_UNIDADE.toFixed(2)})`, valor: TOTAL_EMBALAGENS_ESTIMADO * CUSTO_EMBALAGEM_UNIDADE, categoria: "Embalagens", data: "2025-01-10" },
  ];
}

const emptyForm = { descricao: "", valor: "", categoria: "" as Categoria | "", data: new Date().toISOString().slice(0, 10) };

export default function Financeiro() {
  const matriculasPagas = pizzarias.filter((p) => p.matriculaPaga).length;
  const receitaMatriculas = matriculasPagas * VALOR_MATRICULA;
  const receitaVendas = VENDAS_ESTIMADAS_CICLO * PERCENTUAL_VENDAS;
  const totalReceitas = receitaMatriculas + receitaVendas;

  const [custos, setCustos] = useState<CustoItem[]>(buildInitialCustos);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const totalCustos = custos.reduce((s, c) => s + c.valor, 0);
  const lucro = totalReceitas - totalCustos;

  const receitas = [
    { item: `Matrículas (${matriculasPagas} × R$ ${VALOR_MATRICULA})`, valor: receitaMatriculas },
    { item: `15% sobre vendas (R$ ${VENDAS_ESTIMADAS_CICLO.toLocaleString("pt-BR")})`, valor: receitaVendas },
  ];

  const openNew = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: CustoItem) => { setEditingId(c.id); setForm({ descricao: c.descricao, valor: String(c.valor), categoria: c.categoria, data: c.data }); setDialogOpen(true); };

  const save = () => {
    const val = parseFloat(form.valor as string);
    if (!form.descricao || isNaN(val) || !form.categoria) return;
    if (editingId) {
      setCustos((prev) => prev.map((c) => c.id === editingId ? { ...c, descricao: form.descricao, valor: val, categoria: form.categoria as Categoria, data: form.data } : c));
    } else {
      setCustos((prev) => [...prev, { id: crypto.randomUUID(), descricao: form.descricao, valor: val, categoria: form.categoria as Categoria, data: form.data }]);
    }
    setDialogOpen(false);
  };

  const confirmDelete = () => { if (deleteId) setCustos((prev) => prev.filter((c) => c.id !== deleteId)); setDeleteId(null); };

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-bold">Financeiro</h1>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <TrendingUp className="h-5 w-5 text-success" />
            <CardTitle className="text-sm text-muted-foreground">Total Receitas</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold text-success">{fmt(totalReceitas)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            <CardTitle className="text-sm text-muted-foreground">Total Custos</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold text-destructive">{fmt(totalCustos)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm text-muted-foreground">Lucro Final</CardTitle>
          </CardHeader>
          <CardContent><p className={`text-2xl font-heading font-bold ${lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmt(lucro)}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Receitas */}
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="font-heading text-success">Receitas</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {receitas.map((r) => (
                  <TableRow key={r.item}><TableCell>{r.item}</TableCell><TableCell className="text-right font-medium">{fmt(r.valor)}</TableCell></TableRow>
                ))}
                <TableRow className="border-t-2 border-primary">
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold text-success">{fmt(totalReceitas)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Custos */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-destructive">Custos</CardTitle>
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Adicionar Custo</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right w-[90px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {custos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.descricao}</TableCell>
                    <TableCell>{c.categoria}</TableCell>
                    <TableCell>{new Date(c.data + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(c.valor)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 border-primary">
                  <TableCell colSpan={3} className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold text-destructive">{fmt(totalCustos)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Custo" : "Adicionar Custo"}</DialogTitle>
            <DialogDescription>Preencha os dados do lançamento de custo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Pagamento gráfica" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v as Categoria })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editingId ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir custo?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita. O valor será removido do cálculo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

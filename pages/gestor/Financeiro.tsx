import { useMemo, useState, useEffect } from "react";
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
import { usePizzarias } from "@/contexts/PizzariasContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ExportButton from "@/components/gestor/ExportButton";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const CATEGORIAS = ["Prêmios", "Anúncios", "CardápioWeb", "Captação", "Embalagens", "Outros"] as const;
type Categoria = (typeof CATEGORIAS)[number];

interface CustoItem {
  id: string;
  descricao: string;
  valor: number;
  categoria: Categoria;
  data: string;
  fromDb?: boolean;
}

const emptyForm = { descricao: "", valor: "", categoria: "" as Categoria | "", data: new Date().toISOString().slice(0, 10) };

export default function Financeiro() {
  const { pizzarias } = usePizzarias();
  const matriculasPagas = pizzarias.filter((p) => p.matriculaPaga).length;
  const valorMatricula = 799;
  const receitaMatriculas = matriculasPagas * valorMatricula;

  const [receitaVendas, setReceitaVendas] = useState(0);
  const [custos, setCustos] = useState<CustoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch total sales
      const { data: pedidosData } = await supabase
        .from("pedidos")
        .select("valor_total");
      const totalVendas = pedidosData?.reduce((s, p) => s + Number(p.valor_total), 0) ?? 0;
      setReceitaVendas(totalVendas * 0.15);

      // Fetch custos from DB
      const { data: custosData } = await supabase
        .from("custos")
        .select("*")
        .order("data_lancamento", { ascending: false });

      setCustos((custosData ?? []).map((c: any) => ({
        id: c.id,
        descricao: c.descricao,
        valor: Number(c.valor),
        categoria: c.categoria as Categoria,
        data: c.data_lancamento,
        fromDb: true,
      })));

      setLoading(false);
    };
    fetchData();
  }, []);

  const totalReceitas = receitaMatriculas + receitaVendas;
  const totalCustos = custos.reduce((s, c) => s + c.valor, 0);
  const lucro = totalReceitas - totalCustos;

  const receitas = [
    { item: `Matrículas (${matriculasPagas} × R$ ${valorMatricula})`, valor: receitaMatriculas },
    { item: `15% sobre vendas`, valor: receitaVendas },
  ];

  const openNew = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: CustoItem) => { setEditingId(c.id); setForm({ descricao: c.descricao, valor: String(c.valor), categoria: c.categoria, data: c.data }); setDialogOpen(true); };

  const save = async () => {
    const val = parseFloat(form.valor as string);
    if (!form.descricao || Number.isNaN(val) || !form.categoria) return;

    // Get active campaign
    const { data: campanha } = await supabase
      .from("campanhas")
      .select("id")
      .eq("is_principal", true)
      .limit(1)
      .single();

    if (!campanha) {
      toast.error("Nenhuma campanha ativa encontrada.");
      return;
    }

    if (editingId) {
      const { error } = await supabase.from("custos").update({
        descricao: form.descricao,
        valor: val,
        categoria: form.categoria,
        data_lancamento: form.data,
      }).eq("id", editingId);

      if (error) { toast.error("Erro ao atualizar custo."); return; }
      setCustos((prev) => prev.map((c) => c.id === editingId ? { ...c, descricao: form.descricao, valor: val, categoria: form.categoria as Categoria, data: form.data } : c));
    } else {
      const { data: newCusto, error } = await supabase.from("custos").insert({
        descricao: form.descricao,
        valor: val,
        categoria: form.categoria,
        data_lancamento: form.data,
        campanha_id: campanha.id,
      }).select().single();

      if (error) { toast.error("Erro ao adicionar custo."); return; }
      setCustos((prev) => [...prev, { id: newCusto.id, descricao: form.descricao, valor: val, categoria: form.categoria as Categoria, data: form.data, fromDb: true }]);
    }
    setDialogOpen(false);
    toast.success(editingId ? "Custo atualizado!" : "Custo adicionado!");
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("custos").delete().eq("id", deleteId);
    if (error) { toast.error("Erro ao excluir custo."); setDeleteId(null); return; }
    setCustos((prev) => prev.filter((c) => c.id !== deleteId));
    setDeleteId(null);
    toast.success("Custo excluído!");
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando dados financeiros...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Financeiro</h1>
        <ExportButton
          data={[
            ...receitas.map(r => ({ item: r.item, valor: fmt(r.valor), categoria: "Receita", data: "" })),
            ...custos.map(c => ({ item: c.descricao, valor: fmt(c.valor), categoria: c.categoria, data: c.data })),
          ]}
          columns={[
            { key: "item", label: "Item" }, { key: "valor", label: "Valor" },
            { key: "categoria", label: "Categoria" }, { key: "data", label: "Data" },
          ]}
          fileName="financeiro"
        />
      </div>

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

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-destructive">Custos</CardTitle>
            <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Adicionar Custo</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[90px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {custos.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Nenhum custo registrado.</TableCell></TableRow>
                ) : custos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.descricao}</TableCell>
                    <TableCell>{c.categoria}</TableCell>
                    <TableCell>{new Date(`${c.data}T12:00:00`).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(c.valor)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {custos.length > 0 && (
                  <TableRow className="border-t-2 border-primary">
                    <TableCell colSpan={3} className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold text-destructive">{fmt(totalCustos)}</TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

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

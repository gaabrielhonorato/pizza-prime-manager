import { useState, useEffect, useMemo } from "react";
import {
  Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePizzarias } from "@/contexts/PizzariasContext";
import { toast } from "@/hooks/use-toast";

interface EntregadorRow {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  pizzariaNome: string;
  pizzariaId: string;
  disponivel: boolean;
  criadoEm: string;
}

export default function Entregadores() {
  const { pizzarias } = usePizzarias();
  const [entregadores, setEntregadores] = useState<EntregadorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [detailEntregador, setDetailEntregador] = useState<EntregadorRow | null>(null);
  const [detailMetrics, setDetailMetrics] = useState<{ totalEntregas: number; entregasHoje: number; ultimasEntregas: any[] }>({ totalEntregas: 0, entregasHoje: 0, ultimasEntregas: [] });

  // Dialog
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSenha, setFormSenha] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formPizzaria, setFormPizzaria] = useState("");

  const fetchEntregadores = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("entregadores")
      .select("*, usuarios(nome, email, telefone), pizzarias(nome)");

    if (!error && data) {
      setEntregadores(data.map((e: any) => ({
        id: e.id,
        nome: e.usuarios?.nome ?? "",
        email: e.usuarios?.email ?? "",
        telefone: e.usuarios?.telefone ?? "",
        pizzariaNome: e.pizzarias?.nome ?? "",
        pizzariaId: e.pizzaria_id,
        disponivel: e.disponivel,
        criadoEm: e.criado_em,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchEntregadores(); }, []);

  // Fetch detail metrics
  useEffect(() => {
    if (!detailEntregador) return;
    const fetchDetail = async () => {
      const { data: entRow } = await supabase.from("entregadores").select("id").eq("id", detailEntregador.id).single();
      if (!entRow) return;
      const today = new Date().toISOString().slice(0, 10);
      const { data: allPedidos } = await supabase.from("pedidos").select("id, data_pedido, data_entrega, status, valor_total").eq("entregador_id", entRow.id).order("data_pedido", { ascending: false });
      const totalEntregas = allPedidos?.filter(p => p.status === "entregue").length ?? 0;
      const entregasHoje = allPedidos?.filter(p => p.data_entrega && p.data_entrega.startsWith(today)).length ?? 0;
      const ultimasEntregas = (allPedidos ?? []).slice(0, 5).map(p => ({
        data: new Date(p.data_pedido).toLocaleDateString("pt-BR"),
        hora: new Date(p.data_pedido).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        status: p.status,
        valor: Number(p.valor_total),
      }));
      setDetailMetrics({ totalEntregas, entregasHoje, ultimasEntregas });
    };
    fetchDetail();
  }, [detailEntregador]);

  const filtered = useMemo(() => {
    if (!searchText.trim()) return entregadores;
    const q = searchText.toLowerCase();
    return entregadores.filter((e) =>
      e.nome.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.pizzariaNome.toLowerCase().includes(q)
    );
  }, [entregadores, searchText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const openNew = () => {
    setFormNome(""); setFormEmail(""); setFormSenha(""); setFormTelefone(""); setFormPizzaria("");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!formNome.trim() || !formEmail.trim() || !formSenha.trim() || !formPizzaria) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await supabase.functions.invoke("create-user", {
        body: {
          email: formEmail.trim().toLowerCase(),
          password: formSenha,
          nome: formNome.trim(),
          telefone: formTelefone || null,
          perfil: "entregador",
          extra: { pizzariaId: formPizzaria },
        },
      });
      if (res.error || res.data?.error) {
        toast({ title: "Erro ao cadastrar", description: res.data?.error || res.error?.message, variant: "destructive" });
      } else {
        toast({ title: "Entregador cadastrado com sucesso!" });
        setOpen(false);
        fetchEntregadores();
      }
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("entregadores").delete().eq("id", id);
    if (!error) {
      setEntregadores((prev) => prev.filter((e) => e.id !== id));
      toast({ title: "Entregador removido" });
    } else {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-bold">Entregadores</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar entregador..." value={searchText} onChange={(e) => { setSearchText(e.target.value); setPage(1); }} className="w-[220px] pl-9" />
          </div>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Entregador</Button>
        </div>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        Exibindo <span className="font-semibold text-foreground">{filtered.length}</span> entregadores
      </p>

      <div className="overflow-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Pizzaria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : paged.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Nenhum entregador encontrado.</TableCell></TableRow>
            ) : paged.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.nome}</TableCell>
                <TableCell>{e.email}</TableCell>
                <TableCell>{e.telefone}</TableCell>
                <TableCell>{e.pizzariaNome}</TableCell>
                <TableCell>
                  <Badge variant={e.disponivel ? "default" : "secondary"}>
                    {e.disponivel ? "Disponível" : "Indisponível"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" />Anterior
          </Button>
          <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Próxima<ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Novo Entregador</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label>Nome completo *</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value)} placeholder="Nome do entregador" />
            </div>
            <div className="grid gap-1.5">
              <Label>E-mail de acesso *</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="entregador@email.com" />
            </div>
            <div className="grid gap-1.5">
              <Label>Senha inicial *</Label>
              <Input type="password" value={formSenha} onChange={(e) => setFormSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="grid gap-1.5">
              <Label>Telefone</Label>
              <Input value={formTelefone} onChange={(e) => setFormTelefone(e.target.value)} placeholder="(00) 90000-0000" />
            </div>
            <div className="grid gap-1.5">
              <Label>Pizzaria vinculada *</Label>
              <Select value={formPizzaria} onValueChange={setFormPizzaria}>
                <SelectTrigger><SelectValue placeholder="Selecione uma pizzaria" /></SelectTrigger>
                <SelectContent>
                  {pizzarias.filter((p) => p.status === "Ativa").map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

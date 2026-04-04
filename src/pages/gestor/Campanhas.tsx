import { useState, useEffect, useMemo } from "react";
import {
  Plus, Search, Pencil, Pause, Play, X, Crown, Trash2, Loader2, AlertTriangle, Ticket,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import CampanhaFormDialog from "@/components/gestor/CampanhaFormDialog";
import SubcampanhaFormDialog from "@/components/gestor/SubcampanhaFormDialog";

export interface CampanhaRow {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
  tipo: string;
  is_principal: boolean;
  data_inicio: string;
  data_encerramento: string;
  data_sorteio: string;
  valor_por_cupom: number;
  cupons_por_valor: number;
  valor_minimo_pedido: number;
  limite_cupons_consumidor: number | null;
  limite_cupons_ciclo: number | null;
  arredondamento: string;
  campanha_pai_id: string | null;
  multiplicador_cupons: number;
  cupons_fixos_extras: number;
  desconto_valor_minimo: number;
  pizzarias_permitidas: string[] | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  bonus_indicacao: number;
  criado_em: string;
  // computed
  _totalPedidos?: number;
  _totalCupons?: number;
  _campanhaPaiNome?: string;
}

export default function Campanhas() {
  const [campanhas, setCampanhas] = useState<CampanhaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todas");

  const [formOpen, setFormOpen] = useState(false);
  const [subFormOpen, setSubFormOpen] = useState(false);
  const [editingCampanha, setEditingCampanha] = useState<CampanhaRow | null>(null);

  const [confirmAction, setConfirmAction] = useState<{ id: string; action: string; label: string } | null>(null);

  const fetchCampanhas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("campanhas")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) { toast.error("Erro ao carregar campanhas"); setLoading(false); return; }

    // Enrich with pedidos/cupons counts
    const rows: CampanhaRow[] = (data ?? []).map((c: any) => ({
      ...c,
      _totalPedidos: 0,
      _totalCupons: 0,
      _campanhaPaiNome: "",
    }));

    // Map parent names
    const idMap = new Map(rows.map(r => [r.id, r.nome]));
    for (const r of rows) {
      if (r.campanha_pai_id) r._campanhaPaiNome = idMap.get(r.campanha_pai_id) || "—";
    }

    // Fetch pedidos counts per campaign
    const { data: pedidosCounts } = await supabase
      .from("pedidos")
      .select("campanha_id");
    if (pedidosCounts) {
      const countMap = new Map<string, number>();
      for (const p of pedidosCounts) {
        countMap.set(p.campanha_id, (countMap.get(p.campanha_id) || 0) + 1);
      }
      for (const r of rows) r._totalPedidos = countMap.get(r.id) || 0;
    }

    // Fetch cupons counts
    const { data: cuponsCounts } = await supabase
      .from("cupons")
      .select("campanha_id, quantidade");
    if (cuponsCounts) {
      const countMap = new Map<string, number>();
      for (const c of cuponsCounts) {
        countMap.set(c.campanha_id, (countMap.get(c.campanha_id) || 0) + c.quantidade);
      }
      for (const r of rows) r._totalCupons = countMap.get(r.id) || 0;
    }

    setCampanhas(rows);
    setLoading(false);
  };

  useEffect(() => { fetchCampanhas(); }, []);

  const principal = campanhas.find(c => c.is_principal);
  const diasRestantes = principal ? Math.max(0, differenceInDays(new Date(principal.data_sorteio), new Date())) : null;

  const filtered = useMemo(() => {
    return campanhas.filter(c => {
      if (search && !c.nome.toLowerCase().includes(search.toLowerCase())) return false;
      if (filtroTipo === "principal" && c.tipo !== "principal") return false;
      if (filtroTipo === "subcampanha" && c.tipo !== "subcampanha") return false;
      if (filtroStatus !== "todas" && c.status !== filtroStatus) return false;
      return true;
    });
  }, [campanhas, search, filtroTipo, filtroStatus]);

  const stats = useMemo(() => ({
    total: campanhas.length,
    ativas: campanhas.filter(c => c.status === "ativa").length,
    pausadas: campanhas.filter(c => c.status === "pausada").length,
    encerradas: campanhas.filter(c => c.status === "encerrada").length,
  }), [campanhas]);

  const handleAction = async () => {
    if (!confirmAction) return;
    const { id, action } = confirmAction;
    try {
      if (action === "pausar") {
        await supabase.from("campanhas").update({ status: "pausada" }).eq("id", id);
      } else if (action === "ativar") {
        await supabase.from("campanhas").update({ status: "ativa" }).eq("id", id);
      } else if (action === "encerrar") {
        await supabase.from("campanhas").update({ status: "encerrada" }).eq("id", id);
      } else if (action === "principal") {
        await supabase.from("campanhas").update({ is_principal: true }).eq("id", id);
      } else if (action === "excluir") {
        await supabase.from("campanhas").delete().eq("id", id);
      }
      toast.success("Ação executada!");
      fetchCampanhas();
    } catch {
      toast.error("Erro ao executar ação");
    }
    setConfirmAction(null);
  };

  const openEdit = (c: CampanhaRow) => {
    setEditingCampanha(c);
    if (c.tipo === "subcampanha") setSubFormOpen(true);
    else setFormOpen(true);
  };

  const statusBadge = (s: string) => {
    const cls = s === "ativa" ? "bg-[hsl(var(--success))] text-primary-foreground"
      : s === "pausada" ? "bg-[hsl(var(--warning))] text-primary-foreground"
      : "bg-destructive text-destructive-foreground";
    return <Badge className={cls}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>;
  };

  const tipoBadge = (c: CampanhaRow) => {
    if (c.is_principal) return <Badge className="bg-primary text-primary-foreground">Principal</Badge>;
    if (c.tipo === "subcampanha") return <Badge className="bg-blue-600 text-white">Subcampanha</Badge>;
    return <Badge variant="outline">Campanha</Badge>;
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Carregando campanhas...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Campanhas</h1>
        <div className="flex gap-2">
          <Button onClick={() => { setEditingCampanha(null); setFormOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Nova Campanha
          </Button>
          <Button variant="outline" onClick={() => { setEditingCampanha(null); setSubFormOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Nova Subcampanha
          </Button>
        </div>
      </div>

      {/* Principal highlight */}
      {principal && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-heading">Campanha Principal</CardTitle>
              {statusBadge(principal.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div><span className="text-muted-foreground">Nome</span><p className="font-medium">{principal.nome}</p></div>
              <div><span className="text-muted-foreground">Período</span><p className="font-medium">{format(new Date(principal.data_inicio), "dd/MM/yyyy")} — {format(new Date(principal.data_encerramento), "dd/MM/yyyy")}</p></div>
              <div><span className="text-muted-foreground">Dias restantes</span><p className="font-medium text-primary text-lg">{diasRestantes ?? "—"}</p></div>
              <div><span className="text-muted-foreground">Pedidos</span><p className="font-medium">{principal._totalPedidos}</p></div>
              <div><span className="text-muted-foreground">Cupons</span><p className="font-medium">{principal._totalCupons}</p></div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={() => openEdit(principal)}><Pencil className="mr-1 h-4 w-4" />Editar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="border-border bg-card"><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Ativas</p><p className="text-2xl font-bold text-[hsl(var(--success))]">{stats.ativas}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Pausadas</p><p className="text-2xl font-bold text-[hsl(var(--warning))]">{stats.pausadas}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Encerradas</p><p className="text-2xl font-bold text-destructive">{stats.encerradas}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas os tipos</SelectItem>
            <SelectItem value="principal">Principal</SelectItem>
            <SelectItem value="subcampanha">Subcampanha</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os status</SelectItem>
            <SelectItem value="ativa">Ativa</SelectItem>
            <SelectItem value="pausada">Pausada</SelectItem>
            <SelectItem value="encerrada">Encerrada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Campanha Pai</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Cupons</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma campanha encontrada.</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{tipoBadge(c)}</TableCell>
                  <TableCell>{statusBadge(c.status)}</TableCell>
                  <TableCell className="text-sm">
                    {c.tipo === "subcampanha" && c.periodo_inicio
                      ? `${format(new Date(c.periodo_inicio), "dd/MM")} — ${c.periodo_fim ? format(new Date(c.periodo_fim), "dd/MM") : "—"}`
                      : `${format(new Date(c.data_inicio), "dd/MM/yyyy")} — ${format(new Date(c.data_encerramento), "dd/MM/yyyy")}`
                    }
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c._campanhaPaiNome || "—"}</TableCell>
                  <TableCell className="text-right">{c._totalPedidos}</TableCell>
                  <TableCell className="text-right">{c._totalCupons}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      {c.status === "ativa" ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Pausar" onClick={() => setConfirmAction({ id: c.id, action: "pausar", label: `Pausar "${c.nome}"?` })}><Pause className="h-4 w-4" /></Button>
                      ) : c.status === "pausada" ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Ativar" onClick={() => setConfirmAction({ id: c.id, action: "ativar", label: `Ativar "${c.nome}"?` })}><Play className="h-4 w-4" /></Button>
                      ) : null}
                      {c.status !== "encerrada" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Encerrar" onClick={() => setConfirmAction({ id: c.id, action: "encerrar", label: `Encerrar "${c.nome}"?` })}><X className="h-4 w-4" /></Button>
                      )}
                      {!c.is_principal && c.tipo === "principal" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Definir como principal" onClick={() => setConfirmAction({ id: c.id, action: "principal", label: `Definir "${c.nome}" como campanha principal? A campanha principal atual será desmarcada.` })}><Crown className="h-4 w-4" /></Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir" onClick={() => setConfirmAction({ id: c.id, action: "excluir", label: `Excluir "${c.nome}"? Esta ação não pode ser desfeita.` })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirm dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={o => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ação</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Forms */}
      <CampanhaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        campanha={editingCampanha}
        onSaved={fetchCampanhas}
      />
      <SubcampanhaFormDialog
        open={subFormOpen}
        onOpenChange={setSubFormOpen}
        campanha={editingCampanha}
        campanhasPrincipais={campanhas.filter(c => c.tipo === "principal")}
        onSaved={fetchCampanhas}
      />
    </div>
  );
}

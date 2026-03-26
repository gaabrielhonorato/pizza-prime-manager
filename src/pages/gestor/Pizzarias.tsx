import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Pencil, Trash2, Search, Download, Filter, X, CalendarIcon, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pizzaria } from "@/data/mockData";
import { usePizzarias } from "@/contexts/PizzariasContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const statusVariant = (s: string) =>
  s === "Ativa" ? "default" : s === "Prospectada" ? "secondary" : "outline";

const createEmptyForm = (): Omit<Pizzaria, "id"> => ({
  nome: "",
  responsavel: "",
  cnpj: "",
  telefone: "",
  endereco: "",
  cidade: "",
  bairro: "",
  cep: "",
  status: "Prospectada",
  matriculaPaga: false,
  dataEntrada: new Date().toISOString().slice(0, 10),
  vendas: 0,
});

type SortMode = "cadastro" | "vendas";
type MatriculaFilter = "todas" | "paga" | "pendente";

export default function Pizzarias() {
  const { pizzarias, addPizzaria, updatePizzaria, removePizzaria, refetch } = usePizzarias();

  // Dialog
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<Pizzaria, "id">>(createEmptyForm());
  const [editId, setEditId] = useState<string | null>(null);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [vendasMin, setVendasMin] = useState("");
  const [vendasMax, setVendasMax] = useState("");
  const [statusFilter, setStatusFilter] = useState<Record<string, boolean>>({
    Ativa: false,
    Prospectada: false,
    Inativa: false,
  });
  const [matriculaFilter, setMatriculaFilter] = useState<MatriculaFilter>("todas");
  const [showFilters, setShowFilters] = useState(false);

  // Sort & pagination
  const [sortMode, setSortMode] = useState<SortMode>("cadastro");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Filtered + sorted data
  const filtered = useMemo(() => {
    let result = [...pizzarias];

    // Text search
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((p) =>
        [p.nome, p.cnpj, p.endereco, p.cidade, p.bairro, p.cep]
          .some((f) => f.toLowerCase().includes(q))
      );
    }

    // Date range
    if (dateFrom) {
      result = result.filter((p) => new Date(`${p.dataEntrada}T12:00:00`) >= dateFrom);
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59);
      result = result.filter((p) => new Date(`${p.dataEntrada}T12:00:00`) <= end);
    }

    // Sales range
    const minV = vendasMin ? Number(vendasMin) : null;
    const maxV = vendasMax ? Number(vendasMax) : null;
    if (minV !== null && !isNaN(minV)) result = result.filter((p) => p.vendas >= minV);
    if (maxV !== null && !isNaN(maxV)) result = result.filter((p) => p.vendas <= maxV);

    // Status
    const activeStatuses = Object.entries(statusFilter).filter(([, v]) => v).map(([k]) => k);
    if (activeStatuses.length > 0) {
      result = result.filter((p) => activeStatuses.includes(p.status));
    }

    // Matricula
    if (matriculaFilter === "paga") result = result.filter((p) => p.matriculaPaga);
    if (matriculaFilter === "pendente") result = result.filter((p) => !p.matriculaPaga);

    // Sort
    if (sortMode === "cadastro") {
      result.sort((a, b) => new Date(b.dataEntrada).getTime() - new Date(a.dataEntrada).getTime());
    } else {
      result.sort((a, b) => b.vendas - a.vendas);
    }

    return result;
  }, [pizzarias, searchText, dateFrom, dateTo, vendasMin, vendasMax, statusFilter, matriculaFilter, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  // Reset page when filters change
  const resetPage = () => setCurrentPage(1);

  const clearFilters = () => {
    setSearchText("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setVendasMin("");
    setVendasMax("");
    setStatusFilter({ Ativa: false, Prospectada: false, Inativa: false });
    setMatriculaFilter("todas");
    resetPage();
  };

  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newSenha, setNewSenha] = useState("");

  // CRUD
  const openNew = () => { setForm(createEmptyForm()); setEditId(null); setNewEmail(""); setNewSenha(""); setOpen(true); };
  const openEdit = (p: Pizzaria) => { const { id, ...rest } = p; setForm(rest); setEditId(id); setOpen(true); };
  const handleDelete = (id: string) => removePizzaria(id);
  const handleSave = async () => {
    if (editId) {
      updatePizzaria(editId, form);
      setOpen(false);
      return;
    }
    // New pizzaria: create user via edge function
    if (!newEmail.trim() || !newSenha.trim() || !form.nome.trim()) {
      toast({ title: "Preencha nome, e-mail e senha", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("create-user", {
        body: {
          email: newEmail.trim().toLowerCase(),
          password: newSenha,
          nome: form.responsavel || form.nome,
          telefone: form.telefone || null,
          perfil: "pizzaria",
          extra: {
            nomePizzaria: form.nome,
            cnpj: form.cnpj || null,
            telefone: form.telefone || null,
            endereco: form.endereco || null,
            cidade: form.cidade,
            bairro: form.bairro,
            cep: form.cep || null,
            status: form.status?.toLowerCase() || "ativa",
            matriculaPaga: form.matriculaPaga,
          },
        },
      });
      if (res.error || res.data?.error) {
        toast({ title: "Erro ao cadastrar", description: res.data?.error || res.error?.message, variant: "destructive" });
      } else {
        toast({ title: "Pizzaria cadastrada com sucesso!" });
        setOpen(false);
        refetch();
      }
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // CSV export
  const exportCSV = () => {
    const headers = ["Nome", "Responsável", "CNPJ", "Cidade", "Bairro", "CEP", "Telefone", "Status", "Matrícula", "Data de Cadastro", "Vendas"];
    const rows = filtered.map((p) => [
      p.nome, p.responsavel, p.cnpj, p.cidade, p.bairro, p.cep, p.telefone, p.status,
      p.matriculaPaga ? "Paga" : "Pendente",
      new Date(`${p.dataEntrada}T12:00:00`).toLocaleDateString("pt-BR"),
      String(p.vendas),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pizzarias_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-bold">Pizzarias</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pizzaria..."
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); resetPage(); }}
              className="w-[220px] pl-9"
            />
          </div>
          <Select value={sortMode} onValueChange={(v) => { setSortMode(v as SortMode); resetPage(); }}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cadastro">Ordem de Cadastro</SelectItem>
              <SelectItem value="vendas">Ranking por Vendas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); resetPage(); }}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 30, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>{n} por página</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => setShowFilters((v) => !v)}>
            <Filter className="mr-2 h-4 w-4" />{showFilters ? "Ocultar Filtros" : "Filtros"}
          </Button>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />Exportar
          </Button>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nova Pizzaria</Button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-4 rounded-lg border bg-card p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Search */}
            <div className="space-y-1.5">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, CNPJ, endereço, cidade, bairro, CEP..."
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); resetPage(); }}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Date range */}
            <div className="space-y-1.5">
              <Label>Data de Cadastro</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); resetPage(); }} className="p-3 pointer-events-auto" locale={ptBR} />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); resetPage(); }} className="p-3 pointer-events-auto" locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Sales range */}
            <div className="space-y-1.5">
              <Label>Quantidade de Vendas</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="Mínimo" value={vendasMin} onChange={(e) => { setVendasMin(e.target.value); resetPage(); }} />
                <Input type="number" placeholder="Máximo" value={vendasMax} onChange={(e) => { setVendasMax(e.target.value); resetPage(); }} />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="flex gap-4 pt-1">
                {(["Ativa", "Prospectada", "Inativa"] as const).map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={statusFilter[s]}
                      onCheckedChange={(v) => { setStatusFilter((prev) => ({ ...prev, [s]: !!v })); resetPage(); }}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            {/* Matricula */}
            <div className="space-y-1.5">
              <Label>Matrícula</Label>
              <Select value={matriculaFilter} onValueChange={(v) => { setMatriculaFilter(v as MatriculaFilter); resetPage(); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="paga">Paga</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />Limpar Filtros
            </Button>
          </div>
        </div>
      )}

      {/* Counter */}
      <p className="mb-3 text-sm text-muted-foreground">
        Exibindo <span className="font-semibold text-foreground">{filtered.length}</span> de{" "}
        <span className="font-semibold text-foreground">{pizzarias.length}</span> pizzarias
      </p>

      {/* Table */}
      <div className="overflow-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Bairro</TableHead>
              <TableHead>CEP</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                  Nenhuma pizzaria encontrada.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>{p.responsavel}</TableCell>
                  <TableCell className="text-xs">{p.cnpj}</TableCell>
                  <TableCell>{p.cidade}</TableCell>
                  <TableCell>{p.bairro}</TableCell>
                  <TableCell>{p.cep}</TableCell>
                  <TableCell>{p.telefone}</TableCell>
                  <TableCell><Badge variant={statusVariant(p.status)}>{p.status}</Badge></TableCell>
                  <TableCell>{p.matriculaPaga ? <span className="font-medium text-success">Paga</span> : <span className="text-muted-foreground">Pendente</span>}</TableCell>
                  <TableCell>{new Date(`${p.dataEntrada}T12:00:00`).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right font-medium">{(p.vendas ?? 0).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" />Anterior
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={page === safePage ? "default" : "outline"}
              size="sm"
              className="min-w-[36px]"
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </Button>
          ))}
          <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)}>
            Próxima<ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editId ? "Editar Pizzaria" : "Nova Pizzaria"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!editId && (
              <>
                <div className="grid gap-1.5">
                  <Label>E-mail de acesso *</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="pizzaria@email.com" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Senha inicial *</Label>
                  <Input type="password" value={newSenha} onChange={(e) => setNewSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
                </div>
              </>
            )}
            {([
              ["nome", "Nome da Pizzaria *"],
              ["responsavel", "Responsável"],
              ["cnpj", "CNPJ"],
              ["telefone", "Telefone"],
              ["endereco", "Endereço"],
              ["cidade", "Cidade"],
              ["bairro", "Bairro"],
              ["cep", "CEP"],
            ] as const).map(([field, label]) => (
              <div key={field} className="grid gap-1.5">
                <Label>{label}</Label>
                <Input value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
              </div>
            ))}
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Pizzaria["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Prospectada">Prospectada</SelectItem>
                  <SelectItem value="Ativa">Ativa</SelectItem>
                  <SelectItem value="Inativa">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Data de Entrada</Label>
              <Input type="date" value={form.dataEntrada} onChange={(e) => setForm({ ...form, dataEntrada: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.matriculaPaga} onCheckedChange={(v) => setForm({ ...form, matriculaPaga: v })} />
              <Label>Matrícula Paga</Label>
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

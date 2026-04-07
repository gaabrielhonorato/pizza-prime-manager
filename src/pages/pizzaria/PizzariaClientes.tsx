import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMinhaPizzaria } from "@/contexts/MinhaPizzariaContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserCheck, UserX, UserPlus, Search } from "lucide-react";

interface ClienteRow {
  consumidorId: string;
  nome: string;
  telefone: string;
  totalPedidos: number;
  totalGasto: number;
  cuponsGerados: number;
  primeiroPedido: string | null;
  ultimoPedido: string | null;
  cadastroCompleto: boolean;
  criadoEm: string;
}

export default function PizzariaClientes() {
  const { pizzaria } = useMinhaPizzaria();
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [sortBy, setSortBy] = useState("ultimoPedido");

  useEffect(() => {
    if (!pizzaria) return;
    const fetch = async () => {
      setLoading(true);
      // Get pedidos for this pizzaria
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("consumidor_id, valor_total, cupons_gerados, data_pedido")
        .eq("pizzaria_id", pizzaria.id);

      if (!pedidos || pedidos.length === 0) { setClientes([]); setLoading(false); return; }

      // Aggregate by consumidor
      const map = new Map<string, { total: number; gasto: number; cupons: number; primeiro: string; ultimo: string }>();
      for (const p of pedidos) {
        if (!p.consumidor_id) continue;
        const curr = map.get(p.consumidor_id) ?? { total: 0, gasto: 0, cupons: 0, primeiro: p.data_pedido, ultimo: p.data_pedido };
        curr.total++;
        curr.gasto += Number(p.valor_total);
        curr.cupons += p.cupons_gerados;
        if (p.data_pedido < curr.primeiro) curr.primeiro = p.data_pedido;
        if (p.data_pedido > curr.ultimo) curr.ultimo = p.data_pedido;
        map.set(p.consumidor_id, curr);
      }

      const consIds = [...map.keys()];
      if (consIds.length === 0) { setClientes([]); setLoading(false); return; }

      // Fetch consumidor + usuario info
      const { data: consumidores } = await supabase
        .from("consumidores")
        .select("id, cadastro_completo, criado_em, usuario_id, usuarios(nome, telefone)")
        .in("id", consIds);

      const rows: ClienteRow[] = (consumidores ?? []).map((c: any) => {
        const agg = map.get(c.id);
        return {
          consumidorId: c.id,
          nome: c.usuarios?.nome ?? "—",
          telefone: c.usuarios?.telefone ?? "—",
          totalPedidos: agg?.total ?? 0,
          totalGasto: agg?.gasto ?? 0,
          cuponsGerados: agg?.cupons ?? 0,
          primeiroPedido: agg?.primeiro ?? null,
          ultimoPedido: agg?.ultimo ?? null,
          cadastroCompleto: c.cadastro_completo,
          criadoEm: c.criado_em,
        };
      });

      setClientes(rows);
      setLoading(false);
    };
    fetch();
  }, [pizzaria]);

  const now = new Date();
  const mesAtual = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const totalClientes = clientes.length;
  const completos = clientes.filter(c => c.cadastroCompleto).length;
  const pendentes = totalClientes - completos;
  const novosMes = clientes.filter(c => c.criadoEm >= mesAtual).length;

  const filtered = useMemo(() => {
    let r = [...clientes];
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(c => c.nome.toLowerCase().includes(q) || c.telefone.includes(q));
    }
    if (statusFilter === "completo") r = r.filter(c => c.cadastroCompleto);
    if (statusFilter === "pendente") r = r.filter(c => !c.cadastroCompleto);
    if (sortBy === "ultimoPedido") r.sort((a, b) => (b.ultimoPedido ?? "").localeCompare(a.ultimoPedido ?? ""));
    if (sortBy === "totalGasto") r.sort((a, b) => b.totalGasto - a.totalGasto);
    if (sortBy === "totalPedidos") r.sort((a, b) => b.totalPedidos - a.totalPedidos);
    if (sortBy === "cupons") r.sort((a, b) => b.cuponsGerados - a.cuponsGerados);
    return r;
  }, [clientes, search, statusFilter, sortBy]);

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
  const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">👥 Clientes</h1>
        <p className="text-muted-foreground text-sm mt-1">Consumidores que fizeram pedidos na sua pizzaria.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary/60" />
            <div><p className="text-xs text-muted-foreground">Total de clientes</p><p className="text-2xl font-bold font-heading">{totalClientes}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <UserCheck className="h-8 w-8 text-emerald-500/60" />
            <div><p className="text-xs text-muted-foreground">Completos</p><p className="text-2xl font-bold font-heading">{completos}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <UserX className="h-8 w-8 text-amber-500/60" />
            <div><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-2xl font-bold font-heading">{pendentes}</p></div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <UserPlus className="h-8 w-8 text-blue-500/60" />
            <div><p className="text-xs text-muted-foreground">Novos este mês</p><p className="text-2xl font-bold font-heading">{novosMes}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="completo">Completos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ultimoPedido">Último pedido</SelectItem>
            <SelectItem value="totalGasto">Maior gasto</SelectItem>
            <SelectItem value="totalPedidos">Mais pedidos</SelectItem>
            <SelectItem value="cupons">Mais cupons</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-center">Pedidos</TableHead>
                <TableHead className="text-right">Total gasto</TableHead>
                <TableHead className="text-center">Cupons</TableHead>
                <TableHead>Primeiro pedido</TableHead>
                <TableHead>Último pedido</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.consumidorId}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{c.telefone}</TableCell>
                  <TableCell className="text-center">{c.totalPedidos}</TableCell>
                  <TableCell className="text-right">{fmtMoney(c.totalGasto)}</TableCell>
                  <TableCell className="text-center">{c.cuponsGerados}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(c.primeiroPedido)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(c.ultimoPedido)}</TableCell>
                  <TableCell>
                    <Badge variant={c.cadastroCompleto ? "default" : "secondary"}>
                      {c.cadastroCompleto ? "Completo" : "Pendente"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum cliente encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

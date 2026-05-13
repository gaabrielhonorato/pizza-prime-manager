import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, subDays, eachDayOfInterval, startOfDay, isSameDay } from "date-fns";
import { DollarSign, ShoppingBag, ArrowDownRight, Ticket, TrendingUp, Clock, CreditCard, Users, UserCheck, UserX, UserPlus, Search, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  pizzariaId: string;
  pizzariaNome: string;
}

export default function PizzariaEspelhoContent({ pizzariaId, pizzariaNome: _pizzariaNome }: Props) {
  const [dashStats, setDashStats] = useState({ vendasMes: 0, pedidosMes: 0, cuponsCiclo: 0 });
  const [dashChart, setDashChart] = useState<{ label: string; pedidos: number }[]>([]);
  const [campanha, setCampanha] = useState<{ nome: string; status: string } | null>(null);
  const [repasses, setRepasses] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pedidoSearch, setPedidoSearch] = useState("");
  const [pedidoStatus, setPedidoStatus] = useState("Todos");
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pizzariaId) return;
    setLoading(true);

    const fetchAll = async () => {
      const now = new Date();
      const mesInicio = startOfMonth(now);

      const { data: pedidosData } = await supabase
        .from("pedidos")
        .select("id, data_pedido, valor_total, cupons_gerados, status, canal, consumidor_id, consumidores(usuario_id, usuarios:usuario_id(nome, telefone))")
        .eq("pizzaria_id", pizzariaId)
        .order("data_pedido", { ascending: false });

      const all = pedidosData ?? [];
      const mesPedidos = all.filter(p => new Date(p.data_pedido) >= mesInicio);
      const vendasMes = mesPedidos.reduce((s, p) => s + Number(p.valor_total), 0);

      const pedidoIds = all.map(p => p.id);
      let cuponsCiclo = 0;
      if (pedidoIds.length > 0) {
        const { data: cuponsData } = await supabase
          .from("cupons")
          .select("quantidade, status")
          .in("pedido_id", pedidoIds);
        cuponsCiclo = cuponsData?.filter(c => c.status === "validado" || c.status === "pendente").reduce((s, c) => s + c.quantidade, 0) ?? 0;
      }
      setDashStats({ vendasMes, pedidosMes: mesPedidos.length, cuponsCiclo });

      const from30 = subDays(startOfDay(now), 29);
      const days = eachDayOfInterval({ start: from30, end: startOfDay(now) });
      setDashChart(days.map(d => ({
        label: format(d, "dd/MM"),
        pedidos: all.filter(p => isSameDay(new Date(p.data_pedido), d)).length,
      })));

      const pedidoIdsList = all.map(p => p.id);
      const cuponsPerPedido = new Map<string, number>();
      if (pedidoIdsList.length > 0) {
        const { data: cuponsForPedidos } = await supabase
          .from("cupons")
          .select("pedido_id, quantidade, status")
          .in("pedido_id", pedidoIdsList);
        cuponsForPedidos?.forEach((c: any) => {
          if (c.status === "validado" || c.status === "pendente") {
            cuponsPerPedido.set(c.pedido_id, (cuponsPerPedido.get(c.pedido_id) ?? 0) + c.quantidade);
          }
        });
      }

      setPedidos(all.map((p: any, i: number) => ({
        id: p.id, numero: `#${4000 + i}`, data: new Date(p.data_pedido),
        cliente: p.consumidor_id
          ? (p.consumidores?.usuarios?.nome || p.consumidores?.usuarios?.telefone || "Sem identificação")
          : "Sem identificação",
        clienteSemId: !p.consumidor_id,
        valor: Number(p.valor_total), canal: p.canal, cupons: cuponsPerPedido.get(p.id) ?? 0,
        status: p.status === "cancelado" ? "Cancelado" : "Concluído",
      })));

      const { data: camp } = await supabase.from("campanhas").select("nome, status").eq("is_principal", true).limit(1).single();
      setCampanha(camp);

      const { data: rep } = await supabase.from("repasses").select("*").eq("pizzaria_id", pizzariaId).order("periodo_inicio", { ascending: false });
      setRepasses((rep ?? []).map((r: any) => ({
        id: r.id, periodoInicio: r.periodo_inicio, periodoFim: r.periodo_fim,
        valorBruto: Number(r.valor_bruto), percentual: Number(r.percentual_pizza_premiada),
        valorPizzaPremiada: Number(r.valor_pizza_premiada), valorRepasse: Number(r.valor_repasse),
        dataPagamento: r.data_pagamento, status: r.status,
      })));

      const { data: pedidosCli } = await supabase.from("pedidos").select("id, consumidor_id, valor_total, data_pedido").eq("pizzaria_id", pizzariaId);
      const map = new Map<string, { total: number; gasto: number; primeiro: string; ultimo: string; pedidoIds: string[] }>();
      for (const p of pedidosCli ?? []) {
        if (!p.consumidor_id) continue;
        const curr = map.get(p.consumidor_id) ?? { total: 0, gasto: 0, primeiro: p.data_pedido, ultimo: p.data_pedido, pedidoIds: [] };
        curr.total++; curr.gasto += Number(p.valor_total);
        curr.pedidoIds.push(p.id);
        if (p.data_pedido < curr.primeiro) curr.primeiro = p.data_pedido;
        if (p.data_pedido > curr.ultimo) curr.ultimo = p.data_pedido;
        map.set(p.consumidor_id, curr);
      }
      const consIds = [...map.keys()];

      const allPedidoIdsForClients = [...new Set([...map.values()].flatMap(v => v.pedidoIds))];
      const cuponsPerConsumer = new Map<string, number>();
      if (allPedidoIdsForClients.length > 0) {
        const { data: clientCupons } = await supabase
          .from("cupons")
          .select("consumidor_id, quantidade, status")
          .in("pedido_id", allPedidoIdsForClients);
        clientCupons?.forEach((c: any) => {
          if (c.status === "validado" || c.status === "pendente") {
            cuponsPerConsumer.set(c.consumidor_id, (cuponsPerConsumer.get(c.consumidor_id) ?? 0) + c.quantidade);
          }
        });
      }

      if (consIds.length > 0) {
        const { data: cons } = await supabase.from("consumidores").select("id, cadastro_completo, criado_em, usuario_id, usuarios(nome, telefone, email)").in("id", consIds);
        setClientes((cons ?? []).filter((c: any) => c.usuarios?.telefone).map((c: any) => {
          const agg = map.get(c.id);
          return {
            id: c.id, nome: c.usuarios?.nome || c.usuarios?.telefone || "—", telefone: c.usuarios?.telefone ?? "—",
            totalPedidos: agg?.total ?? 0, totalGasto: agg?.gasto ?? 0, cuponsGerados: cuponsPerConsumer.get(c.id) ?? 0,
            primeiroPedido: agg?.primeiro ?? null, ultimoPedido: agg?.ultimo ?? null,
            cadastroCompleto: c.cadastro_completo, criadoEm: c.criado_em,
          };
        }));
      } else {
        setClientes([]);
      }

      setLoading(false);
    };
    fetchAll();
  }, [pizzariaId]);

  const totalVendidoPizzaria = pedidos.reduce((s, p) => s + p.valor, 0);
  const totalPedidosPizzaria = pedidos.length;
  const ticketMedioPizzaria = totalPedidosPizzaria > 0 ? totalVendidoPizzaria / totalPedidosPizzaria : 0;
  const repassePizzaria = totalVendidoPizzaria * 0.85;
  const taxaPizzaPremiada = totalVendidoPizzaria * 0.15;
  const repasseMes = Math.round(dashStats.vendasMes * 0.85);

  const filteredPedidos = useMemo(() => {
    let list = [...pedidos];
    if (pedidoSearch) { const q = pedidoSearch.toLowerCase(); list = list.filter(p => p.cliente.toLowerCase().includes(q) || p.numero.includes(q)); }
    if (pedidoStatus !== "Todos") list = list.filter(p => p.status === pedidoStatus);
    return list;
  }, [pedidos, pedidoSearch, pedidoStatus]);

  const filteredClientes = useMemo(() => {
    if (!clienteSearch.trim()) return clientes;
    const q = clienteSearch.toLowerCase();
    return clientes.filter(c => c.nome.toLowerCase().includes(q) || c.telefone.includes(q));
  }, [clientes, clienteSearch]);

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
  const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  }

  return (
    <Tabs defaultValue="dashboard" className="space-y-4">
      <TabsList>
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
        <TabsTrigger value="clientes">Clientes</TabsTrigger>
      </TabsList>

      {/* DASHBOARD */}
      <TabsContent value="dashboard" className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Vendas do mês", value: fmtMoney(dashStats.vendasMes), icon: DollarSign },
            { label: "Pedidos do mês", value: String(dashStats.pedidosMes), icon: ShoppingBag },
            { label: "Repasse a receber (85%)", value: fmtMoney(repasseMes), icon: ArrowDownRight },
            { label: "Cupons no ciclo", value: String(dashStats.cuponsCiclo), icon: Ticket },
          ].map(k => (
            <Card key={k.label} className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
                <k.icon className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{k.value}</p></CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">Pedidos por dia (últimos 30 dias)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{ pedidos: { label: "Pedidos", color: "hsl(25 95% 53%)" } }} className="h-[250px] w-full">
              <BarChart data={dashChart} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} interval="preserveStartEnd" />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="pedidos" fill="hsl(25 95% 53%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {campanha && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3"><Trophy className="h-8 w-8 text-primary" /></div>
              <div>
                <h3 className="font-heading font-bold text-lg">Campanha: {campanha.nome}</h3>
                <p className="text-sm text-muted-foreground">Status: <strong className="text-primary">{campanha.status}</strong></p>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* FINANCEIRO */}
      <TabsContent value="financeiro" className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Total vendido", value: fmtMoney(totalVendidoPizzaria), icon: DollarSign },
            { label: "Repasse (85%)", value: fmtMoney(repassePizzaria), icon: TrendingUp },
            { label: "Taxa Pizza Premiada (15%)", value: fmtMoney(taxaPizzaPremiada), icon: CreditCard },
            { label: "Total de pedidos", value: String(totalPedidosPizzaria), icon: ShoppingBag },
            { label: "Ticket médio", value: fmtMoney(ticketMedioPizzaria), icon: Clock },
          ].map(k => (
            <Card key={k.label} className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
                <k.icon className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{k.value}</p></CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      {/* PEDIDOS */}
      <TabsContent value="pedidos" className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-8 h-8 text-xs" value={pedidoSearch} onChange={e => setPedidoSearch(e.target.value)} />
          </div>
          <Select value={pedidoStatus} onValueChange={setPedidoStatus}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              <SelectItem value="Concluído">Concluído</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Card className="border-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Cupons</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPedidos.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum pedido.</TableCell></TableRow>
                ) : filteredPedidos.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-xs">{p.numero}</TableCell>
                    <TableCell className="text-xs">{format(p.data, "dd/MM/yy HH:mm")}</TableCell>
                    <TableCell className={`text-xs ${p.clienteSemId ? "text-muted-foreground italic" : ""}`}>{p.cliente}</TableCell>
                    <TableCell className="text-right text-xs">{fmtMoney(p.valor)}</TableCell>
                    <TableCell className="text-xs">{p.canal}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-primary">{p.cupons}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.status === "Concluído" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* CLIENTES */}
      <TabsContent value="clientes" className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total de clientes", value: clientes.length, icon: Users, color: "text-primary/60" },
            { label: "Completos", value: clientes.filter(c => c.cadastroCompleto).length, icon: UserCheck, color: "text-emerald-500/60" },
            { label: "Pendentes", value: clientes.filter(c => !c.cadastroCompleto).length, icon: UserX, color: "text-amber-500/60" },
            { label: "Novos este mês", value: clientes.filter(c => c.criadoEm && new Date(c.criadoEm) >= startOfMonth(new Date())).length, icon: UserPlus, color: "text-blue-500/60" },
          ].map(k => (
            <Card key={k.label} className="border-border">
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <k.icon className={`h-8 w-8 ${k.color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-2xl font-bold font-heading">{k.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." className="pl-9" value={clienteSearch} onChange={e => setClienteSearch(e.target.value)} />
        </div>
        <Card className="border-border">
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
                {filteredClientes.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum cliente.</TableCell></TableRow>
                ) : filteredClientes.map(c => (
                  <TableRow key={c.id}>
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
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

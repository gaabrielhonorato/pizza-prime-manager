import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, subDays, eachDayOfInterval, startOfDay, endOfDay, isSameDay, subMonths, endOfMonth } from "date-fns";
import { DollarSign, ShoppingBag, ArrowDownRight, Ticket, TrendingUp, Clock, CreditCard, Users, UserCheck, UserX, UserPlus, Search, Trophy, XCircle, AlertCircle, BarChart2, Receipt, ExternalLink, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import ExportButton from "@/components/gestor/ExportButton";
import CobrancaDetalheModal from "@/components/gestor/CobrancaDetalheModal";

interface Props {
  pizzariaId: string;
  pizzariaNome: string;
  pizzariaCnpj?: string | null;
  controlled?: boolean;
}

type DashQuick = "este_mes" | "mes_anterior" | "7dias" | "30dias" | "ciclo";

const DASH_QUICK_LABELS: Record<DashQuick, string> = {
  este_mes: "Este mês",
  mes_anterior: "Mês anterior",
  "7dias": "7 dias",
  "30dias": "30 dias",
  ciclo: "Todo o ciclo",
};

function getDashRange(q: DashQuick): [Date, Date] {
  const today = startOfDay(new Date());
  switch (q) {
    case "este_mes": return [startOfMonth(today), endOfDay(today)];
    case "mes_anterior": { const prev = subMonths(today, 1); return [startOfMonth(prev), endOfDay(endOfMonth(prev))]; }
    case "7dias": return [subDays(today, 6), endOfDay(today)];
    case "30dias": return [subDays(today, 29), endOfDay(today)];
    case "ciclo": return [new Date(0), endOfDay(today)];
  }
}

export default function PizzariaEspelhoContent({ pizzariaId, pizzariaNome, pizzariaCnpj, controlled }: Props) {
  const [campanha, setCampanha] = useState<any>(null);
  const [repasses, setRepasses] = useState<any[]>([]);
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pedidoSearch, setPedidoSearch] = useState("");
  const [pedidoStatus, setPedidoStatus] = useState("Todos");
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCobranca, setSelectedCobranca] = useState<any>(null);

  // Dashboard period filter
  const [dashQuick, setDashQuick] = useState<DashQuick>("este_mes");
  const [dashFrom, setDashFrom] = useState<Date>(() => startOfMonth(new Date()));
  const [dashTo, setDashTo] = useState<Date>(() => endOfDay(new Date()));
  const [dashCustomFromStr, setDashCustomFromStr] = useState("");
  const [dashCustomToStr, setDashCustomToStr] = useState("");

  const selectDashQuick = (q: DashQuick) => {
    setDashQuick(q);
    const [f, t] = getDashRange(q);
    setDashFrom(f); setDashTo(t);
    setDashCustomFromStr(q !== "ciclo" ? format(f, "yyyy-MM-dd") : "");
    setDashCustomToStr(q !== "ciclo" ? format(t, "yyyy-MM-dd") : "");
  };

  const applyDashCustom = () => {
    if (dashCustomFromStr && dashCustomToStr) {
      setDashQuick("ciclo");
      setDashFrom(startOfDay(new Date(dashCustomFromStr + "T00:00:00")));
      setDashTo(endOfDay(new Date(dashCustomToStr + "T00:00:00")));
    }
  };

  useEffect(() => {
    if (!pizzariaId) return;
    setLoading(true);

    const fetchAll = async () => {
      const { data: pedidosData } = await supabase
        .from("pedidos")
        .select("id, data_pedido, valor_total, cupons_gerados, status, canal, consumidor_id, consumidores(usuario_id, usuarios:usuario_id(nome, telefone))")
        .eq("pizzaria_id", pizzariaId)
        .order("data_pedido", { ascending: false });

      const all = pedidosData ?? [];
      const pedidoIdsList = all.map((p: any) => p.id);

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

      const { data: camp } = await supabase.from("campanhas").select("*").eq("is_principal", true).limit(1).single();
      setCampanha(camp);

      const { data: cobs } = await supabase
        .from("cobrancas_repasse")
        .select("*")
        .eq("pizzaria_id", pizzariaId)
        .neq("status", "cancelado")
        .order("periodo_inicio", { ascending: false });
      setCobrancas(cobs ?? []);

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

  // Dashboard period filtered pedidos
  const dashPeriodPedidos = useMemo(() => {
    if (dashQuick === "ciclo") return pedidos;
    return pedidos.filter(p => p.data >= dashFrom && p.data <= dashTo);
  }, [pedidos, dashQuick, dashFrom, dashTo]);

  // Dashboard KPI stats from period
  const dashStats = useMemo(() => ({
    vendas: dashPeriodPedidos.reduce((s, p) => s + p.valor, 0),
    pedidosCount: dashPeriodPedidos.length,
    cupons: dashPeriodPedidos.reduce((s, p) => s + p.cupons, 0),
  }), [dashPeriodPedidos]);

  // Dashboard chart — day-by-day for ≤60 days, monthly for longer ranges
  const dashChartData = useMemo(() => {
    const chartFrom = dashQuick === "ciclo"
      ? (pedidos.length > 0 ? startOfDay(pedidos.reduce((min, p) => p.data < min ? p.data : min, pedidos[0].data)) : subDays(startOfDay(new Date()), 29))
      : startOfDay(dashFrom);
    const chartTo = startOfDay(dashTo);
    const diffDays = Math.ceil((chartTo.getTime() - chartFrom.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 60) {
      const days = eachDayOfInterval({ start: chartFrom, end: chartTo });
      return days.map(d => ({
        label: format(d, "dd/MM"),
        pedidos: dashPeriodPedidos.filter(p => isSameDay(p.data, d)).length,
      }));
    }
    // Monthly aggregation for large ranges
    const months = new Map<string, number>();
    dashPeriodPedidos.forEach(p => {
      const k = format(p.data, "MM/yy");
      months.set(k, (months.get(k) ?? 0) + 1);
    });
    return [...months.entries()].map(([label, cnt]) => ({ label, pedidos: cnt }));
  }, [dashPeriodPedidos, dashFrom, dashTo, dashQuick, pedidos]);

  // Financeiro tab — uses all pedidos (no period filter)
  const totalVendidoPizzaria = pedidos.reduce((s, p) => s + p.valor, 0);
  const totalPedidosPizzaria = pedidos.length;
  const ticketMedioPizzaria = totalPedidosPizzaria > 0 ? totalVendidoPizzaria / totalPedidosPizzaria : 0;
  const repassePizzaria = totalVendidoPizzaria * 0.85;
  const taxaPizzaPremiada = totalVendidoPizzaria * 0.15;

  const repassePeriodo = Math.round(dashStats.vendas * 0.85);

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

  const cancelados = pedidos.filter(p => p.status === "Cancelado");
  const taxaCancelamento = pedidos.length > 0 ? (cancelados.length / pedidos.length * 100).toFixed(1) : "0.0";
  const valorPerdido = cancelados.reduce((s, p) => s + p.valor, 0);

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
  const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const dashPeriodLabel = dashQuick !== "ciclo" ? DASH_QUICK_LABELS[dashQuick] : (
    dashCustomFromStr && dashCustomToStr
      ? `${format(dashFrom, "dd/MM/yyyy")} – ${format(dashTo, "dd/MM/yyyy")}`
      : DASH_QUICK_LABELS.ciclo
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  }

  const tabsContent = (
    <>
      {!controlled && (
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
        </TabsList>
      )}

      {/* DASHBOARD */}
      <TabsContent value="dashboard" className="space-y-6">
        {/* Período filter chip */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {dashPeriodLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 space-y-3" align="start">
              <p className="text-xs font-medium text-muted-foreground">Período</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(DASH_QUICK_LABELS) as DashQuick[]).map((q) => (
                  <Button key={q} variant={dashQuick === q ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => selectDashQuick(q)}>
                    {DASH_QUICK_LABELS[q]}
                  </Button>
                ))}
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Personalizado</p>
                <div className="flex items-center gap-1">
                  <Input type="date" className="h-7 text-xs" value={dashCustomFromStr} onChange={(e) => setDashCustomFromStr(e.target.value)} />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input type="date" className="h-7 text-xs" value={dashCustomToStr} onChange={(e) => setDashCustomToStr(e.target.value)} />
                </div>
                <Button size="sm" className="text-xs h-7 w-full" onClick={applyDashCustom} disabled={!dashCustomFromStr || !dashCustomToStr}>Aplicar</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Vendas no período", value: fmtMoney(dashStats.vendas), icon: DollarSign },
            { label: "Pedidos no período", value: String(dashStats.pedidosCount), icon: ShoppingBag },
            { label: "Repasse (85%)", value: fmtMoney(repassePeriodo), icon: ArrowDownRight },
            { label: "Cupons no período", value: String(dashStats.cupons), icon: Ticket },
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
          <CardHeader>
            <CardTitle className="text-base">Pedidos por dia</CardTitle>
            <p className="text-xs text-muted-foreground">{dashPeriodLabel}</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ pedidos: { label: "Pedidos", color: "hsl(25 95% 53%)" } }} className="h-[250px] w-full">
              <BarChart data={dashChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} interval="preserveStartEnd" />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar animationDuration={3000} animationEasing="linear" dataKey="pedidos" fill="hsl(25 95% 53%)" radius={[4, 4, 0, 0]}/>
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

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Pedidos cancelados", value: String(cancelados.length), icon: XCircle, color: "text-red-500" },
            { label: "Taxa de cancelamento", value: `${taxaCancelamento}%`, icon: AlertCircle, color: "text-amber-500" },
            { label: "Valor perdido", value: fmtMoney(valorPerdido), icon: BarChart2, color: "text-red-400" },
          ].map(k => (
            <Card key={k.label} className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
                <k.icon className={`h-5 w-5 ${k.color}`} />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold">{k.value}</p></CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Pedidos com cupons gerados: <span className="font-semibold text-foreground">{pedidos.filter(p => p.cupons > 0).length}</span>
          </p>
          <ExportButton
            data={pedidos.filter(p => p.cupons > 0).map(p => ({
              numero: p.numero,
              data: format(p.data, "dd/MM/yyyy HH:mm"),
              cliente: p.cliente,
              valor: p.valor,
              canal: p.canal,
              cupons_gerados: p.cupons,
              status: p.status,
            }))}
            columns={[
              { key: "numero", label: "Nº Pedido" },
              { key: "data", label: "Data/Hora" },
              { key: "cliente", label: "Cliente" },
              { key: "valor", label: "Valor (R$)" },
              { key: "canal", label: "Canal" },
              { key: "cupons_gerados", label: "Cupons Gerados" },
              { key: "status", label: "Status" },
            ]}
            fileName={`cupons-${pizzariaNome.replace(/\s+/g, "-").toLowerCase()}`}
          />
        </div>
      </TabsContent>

      {/* FINANCEIRO */}
      <TabsContent value="financeiro" className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Total vendido", value: fmtMoney(totalVendidoPizzaria), icon: DollarSign },
            { label: "Faturamento Pizzaria", value: fmtMoney(repassePizzaria), icon: TrendingUp },
            { label: "Faturamento Pizza Premiada", value: fmtMoney(taxaPizzaPremiada), icon: CreditCard },
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

        {/* Histórico de cobranças */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Receipt className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Histórico de Cobranças</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {cobrancas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma cobrança registrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>NFS-e</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cobrancas.map((c: any) => {
                    const statusMap: Record<string, { cls: string; label: string }> = {
                      pendente: { cls: "bg-muted text-muted-foreground", label: "Pendente" },
                      agendado: { cls: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Agendado" },
                      enviado:  { cls: "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 border-amber-500 dark:border-amber-500/30", label: "Enviado" },
                      pago:     { cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Pago" },
                    };
                    const st = statusMap[c.status] ?? statusMap.pendente;
                    const nfseLabel = c.spedy_invoice_status === "authorized" ? "Autorizada" : c.spedy_invoice_status === "rejected" ? "Rejeitada" : c.spedy_invoice_status ? "Pendente" : "—";
                    const nfseCls = c.spedy_invoice_status === "authorized" ? "text-emerald-400" : c.spedy_invoice_status === "rejected" ? "text-red-400" : "text-muted-foreground";
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs font-medium">
                          {c.periodo_inicio} a {c.periodo_fim}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {Array.isArray(c.pedidos_snapshot) ? c.pedidos_snapshot.length : 0}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold">
                          {fmtMoney(Number(c.valor_total_devido))}
                        </TableCell>
                        <TableCell className="text-xs">
                          {c.vencimento_boleto
                            ? format(new Date(c.vencimento_boleto + "T12:00:00"), "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[11px] ${st.cls}`}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className={`text-xs ${nfseCls}`}>{nfseLabel}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {c.boleto_url && (
                              <a href={c.boleto_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                                <ExternalLink className="h-3 w-3" /> Boleto
                              </a>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Ver detalhes" onClick={() => setSelectedCobranca(c)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
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
          <ExportButton
            data={filteredPedidos.map(p => ({
              numero: p.numero,
              data: format(p.data, "dd/MM/yyyy HH:mm"),
              cliente: p.cliente,
              valor: p.valor,
              canal: p.canal,
              cupons: p.cupons,
              status: p.status,
            }))}
            columns={[
              { key: "numero", label: "Nº Pedido" },
              { key: "data", label: "Data/Hora" },
              { key: "cliente", label: "Cliente" },
              { key: "valor", label: "Valor (R$)" },
              { key: "canal", label: "Canal" },
              { key: "cupons", label: "Cupons" },
              { key: "status", label: "Status" },
            ]}
            fileName={`pedidos-${pizzariaNome.replace(/\s+/g, "-").toLowerCase()}`}
          />
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
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou telefone..." className="pl-9" value={clienteSearch} onChange={e => setClienteSearch(e.target.value)} />
          </div>
          <ExportButton
            data={filteredClientes.map(c => ({
              nome: c.nome,
              telefone: c.telefone,
              total_pedidos: c.totalPedidos,
              total_gasto: c.totalGasto,
              cupons_gerados: c.cuponsGerados,
              primeiro_pedido: fmtDate(c.primeiroPedido),
              ultimo_pedido: fmtDate(c.ultimoPedido),
              cadastro: c.cadastroCompleto ? "Completo" : "Pendente",
            }))}
            columns={[
              { key: "nome", label: "Nome" },
              { key: "telefone", label: "Telefone" },
              { key: "total_pedidos", label: "Total de Pedidos" },
              { key: "total_gasto", label: "Total Gasto (R$)" },
              { key: "cupons_gerados", label: "Cupons Gerados" },
              { key: "primeiro_pedido", label: "Primeiro Pedido" },
              { key: "ultimo_pedido", label: "Último Pedido" },
              { key: "cadastro", label: "Status Cadastro" },
            ]}
            fileName={`clientes-${pizzariaNome.replace(/\s+/g, "-").toLowerCase()}`}
          />
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
    </>
  );

  const modal = (
    <CobrancaDetalheModal
      cobranca={selectedCobranca}
      pizzariaNome={pizzariaNome}
      pizzariaCnpj={pizzariaCnpj ?? null}
      campanha={campanha}
      onClose={() => setSelectedCobranca(null)}
      onRefresh={async () => {
        const { data: cobs } = await supabase
          .from("cobrancas_repasse")
          .select("*")
          .eq("pizzaria_id", pizzariaId)
          .neq("status", "cancelado")
          .order("periodo_inicio", { ascending: false });
        setCobrancas(cobs ?? []);
      }}
    />
  );

  if (controlled) {
    return (
      <>
        {tabsContent}
        {modal}
      </>
    );
  }

  return (
    <Tabs defaultValue="dashboard" className="space-y-4">
      {tabsContent}
      {modal}
    </Tabs>
  );
}

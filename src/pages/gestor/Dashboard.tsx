import { useState, useMemo, useEffect } from "react";
import { startOfMonth, endOfDay, isWithinInterval } from "date-fns";
import { Store, BarChart3, Trophy, Ticket, MapPin, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Receipt, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePizzarias } from "@/contexts/PizzariasContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SalesChart from "@/components/gestor/SalesChart";
import CanalDonut from "@/components/gestor/CanalDonut";
import PagamentoDonut from "@/components/gestor/PagamentoDonut";
import CidadeBarChart from "@/components/gestor/CidadeBarChart";
import { supabase } from "@/integrations/supabase/client";

const META_PIZZARIAS = 40;

const medalColors: Record<number, string> = {
  0: "bg-yellow-500 text-black",
  1: "bg-gray-400 text-black",
  2: "bg-amber-700 text-white",
};

interface PedidoDetalhe {
  id: string;
  canal: string;
  forma_pagamento: string;
  pizzaria_id: string;
  status: string;
  valor_total: number;
  data_pedido: string;
}

interface CupomRaw {
  pedido_id: string | null;
  quantidade: number;
  status: string;
}

export default function Dashboard() {
  const { pizzarias } = usePizzarias();

  // Datas do filtro — elevadas do SalesChart para aqui
  const [dateFrom, setDateFrom] = useState<Date>(() => startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(() => endOfDay(new Date()));

  // Estado da campanha (não filtrado por data)
  const [diasSorteio, setDiasSorteio] = useState<number | null>(null);
  const [dataSorteioStr, setDataSorteioStr] = useState<string | null>(null);
  const [hasCampanha, setHasCampanha] = useState(true);
  const [comissao, setComissao] = useState(0.15);
  const [consumidoresAtivos, setConsumidoresAtivos] = useState(0);
  const [entregadores, setEntregadores] = useState(0);

  // Dados brutos (todos os períodos)
  const [pedidosDetalhes, setPedidosDetalhes] = useState<PedidoDetalhe[]>([]);
  const [cuponsRaw, setCuponsRaw] = useState<CupomRaw[]>([]);

  const ativas = pizzarias.filter((p) => p.status === "Ativa").length;

  const fetchData = async () => {
    const { data: campData } = await supabase
      .from("campanhas")
      .select("id, data_sorteio, valor_por_cupom, limite_cupons_consumidor, percentual_comissao")
      .eq("is_principal", true)
      .limit(1)
      .single();

    if (!campData) {
      setHasCampanha(false);
      return;
    }

    const comissaoDecimal = (Number((campData as any).percentual_comissao) || 15) / 100;
    setComissao(comissaoDecimal);

    const sorteioDate = new Date(campData.data_sorteio);
    const diffMs = sorteioDate.getTime() - new Date().getTime();
    setDiasSorteio(Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    setDataSorteioStr(sorteioDate.toLocaleDateString("pt-BR"));

    // Busca pedidos com data e ID para filtrar localmente
    const { data: pedidosData } = await supabase
      .from("pedidos")
      .select("id, valor_total, canal, forma_pagamento, pizzaria_id, status, data_pedido")
      .eq("campanha_id", campData.id);

    setPedidosDetalhes(
      (pedidosData ?? []).map((p: any) => ({
        id: p.id,
        canal: p.canal ?? "outros",
        forma_pagamento: p.forma_pagamento ?? "outros",
        pizzaria_id: p.pizzaria_id ?? "",
        status: p.status ?? "",
        valor_total: Number(p.valor_total),
        data_pedido: p.data_pedido ?? "",
      }))
    );

    // Busca cupons com pedido_id para filtrar pelo período
    const { data: cuponsData } = await supabase
      .from("cupons")
      .select("pedido_id, quantidade, status")
      .eq("campanha_id", campData.id);
    setCuponsRaw(cuponsData ?? []);

    const limiteConsumidor = (campData as any).limite_cupons_consumidor as number | null;
    const { count: consCount } = await supabase
      .from("consumidores")
      .select("*", { count: "exact", head: true })
      .eq("cadastro_completo", true);
    setConsumidoresAtivos(consCount ?? 0);

    const { count: entCount } = await supabase
      .from("entregadores")
      .select("*", { count: "exact", head: true });
    setEntregadores(entCount ?? 0);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "cupons" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const getSorteioColor = () => {
    if (diasSorteio === null) return "text-foreground";
    if (diasSorteio <= 7) return "text-destructive";
    if (diasSorteio <= 30) return "text-orange-500";
    return "text-green-600";
  };

  // Pedidos filtrados pelo período selecionado no gráfico
  const filteredPedidos = useMemo(() => {
    if (!pedidosDetalhes.length) return [];
    const interval = { start: dateFrom, end: dateTo };
    return pedidosDetalhes.filter(p => {
      if (!p.data_pedido) return false;
      return isWithinInterval(new Date(p.data_pedido), interval);
    });
  }, [pedidosDetalhes, dateFrom, dateTo]);

  // IDs dos pedidos filtrados (para cruzar com cupons)
  const filteredPedidoIds = useMemo(
    () => new Set(filteredPedidos.map(p => p.id)),
    [filteredPedidos]
  );

  // ── KPIs da campanha INTEIRA (não filtrados por data) — Grupo 1 ──
  const faturamentoTotal = useMemo(
    () => pedidosDetalhes.filter(p => p.status === "entregue").reduce((s, p) => s + p.valor_total, 0),
    [pedidosDetalhes]
  );

  const faturamentoPP = useMemo(
    () => faturamentoTotal * comissao,
    [faturamentoTotal, comissao]
  );

  // ── KPIs do período selecionado (filtrados por data) — Grupo 2 ──
  const totalPedidosPeriodo = useMemo(() => filteredPedidos.length, [filteredPedidos]);

  const cuponsValidados = useMemo(
    () => cuponsRaw
      .filter(c => (c.status === "validado" || c.status === "pendente") && c.pedido_id && filteredPedidoIds.has(c.pedido_id))
      .reduce((s, c) => s + c.quantidade, 0),
    [cuponsRaw, filteredPedidoIds]
  );

  const ticketMedio = useMemo(() => {
    const entregues = filteredPedidos.filter(p => p.status === "entregue");
    if (!entregues.length) return 0;
    return entregues.reduce((s, p) => s + p.valor_total, 0) / entregues.length;
  }, [filteredPedidos]);

  const taxaCancelamento = useMemo(() => {
    if (!filteredPedidos.length) return 0;
    return (filteredPedidos.filter(p => p.status === "cancelado").length / filteredPedidos.length) * 100;
  }, [filteredPedidos]);

  const canalData = useMemo(() => {
    const map = new Map<string, number>();
    filteredPedidos.forEach(p => { map.set(p.canal, (map.get(p.canal) ?? 0) + 1); });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredPedidos]);

  const pagamentoData = useMemo(() => {
    const map = new Map<string, number>();
    filteredPedidos.forEach(p => { map.set(p.forma_pagamento, (map.get(p.forma_pagamento) ?? 0) + 1); });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredPedidos]);

  const cidadeFaturamento = useMemo(() => {
    const map = new Map<string, number>();
    filteredPedidos.filter(p => p.status === "entregue").forEach(p => {
      const pizzaria = pizzarias.find(pz => pz.id === p.pizzaria_id);
      const cidade = pizzaria?.cidade ?? "Sem cidade";
      map.set(cidade, (map.get(cidade) ?? 0) + p.valor_total * comissao);
    });
    return [...map.entries()]
      .map(([cidade, fat]) => ({ cidade, faturamento: fat }))
      .sort((a, b) => b.faturamento - a.faturamento)
      .slice(0, 7);
  }, [filteredPedidos, pizzarias, comissao]);

  // Ranking Top 5 calculado do período filtrado
  const top5 = useMemo(() => {
    const countMap = new Map<string, number>();
    filteredPedidos.forEach(p => {
      countMap.set(p.pizzaria_id, (countMap.get(p.pizzaria_id) ?? 0) + 1);
    });
    const pool = pizzarias.filter(p => p.status === "Ativa");
    const sorted = pool
      .map(p => ({ ...p, vendas: countMap.get(p.id) ?? 0 }))
      .sort((a, b) => b.vendas - a.vendas)
      .slice(0, 5);
    const maxVendas = sorted[0]?.vendas || 1;
    return sorted.map((p, i) => ({ ...p, pos: i, pct: (p.vendas / maxVendas) * 100 }));
  }, [filteredPedidos, pizzarias]);

  // Mapa de cidades calculado do período filtrado
  const cityData = useMemo(() => {
    const map = new Map<string, { pizzariaSet: Set<string>; vendas: number; bairros: Map<string, { pizzariaSet: Set<string>; vendas: number }> }>();
    filteredPedidos.forEach(p => {
      const pizzaria = pizzarias.find(pz => pz.id === p.pizzaria_id);
      const city = pizzaria?.cidade ?? "Sem cidade";
      const bairro = pizzaria?.bairro ?? "Sem bairro";
      if (!map.has(city)) map.set(city, { pizzariaSet: new Set(), vendas: 0, bairros: new Map() });
      const c = map.get(city)!;
      c.pizzariaSet.add(p.pizzaria_id);
      c.vendas++;
      if (!c.bairros.has(bairro)) c.bairros.set(bairro, { pizzariaSet: new Set(), vendas: 0 });
      const b = c.bairros.get(bairro)!;
      b.pizzariaSet.add(p.pizzaria_id);
      b.vendas++;
    });
    return [...map.entries()]
      .map(([cidade, d]) => ({
        cidade,
        pizzarias: d.pizzariaSet.size,
        vendas: d.vendas,
        bairros: [...d.bairros.entries()]
          .map(([bairro, bd]) => ({ bairro, pizzarias: bd.pizzariaSet.size, vendas: bd.vendas }))
          .sort((a, b) => b.vendas - a.vendas),
      }))
      .sort((a, b) => b.vendas - a.vendas);
  }, [filteredPedidos, pizzarias]);

  const [expandedCities, setExpandedCities] = useState<string[]>([]);
  const toggleCity = (c: string) =>
    setExpandedCities((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Visão geral da campanha ativa</p>
      </div>

      {/* Grupo 1 — dados estáticos */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pizzarias Ativas</p>
                <p className="text-2xl font-heading font-bold mt-1.5 leading-none">{ativas}</p>
                <p className="text-xs text-muted-foreground mt-2">de {META_PIZZARIAS} na meta</p>
              </div>
              <div className="shrink-0 rounded-xl bg-primary/10 p-2.5">
                <Store className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Entregadores</p>
                <p className="text-2xl font-heading font-bold mt-1.5 leading-none">{entregadores.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground mt-2">cadastrados</p>
              </div>
              <div className="shrink-0 rounded-xl bg-blue-500/10 p-2.5">
                <BarChart3 className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Consumidores</p>
                <p className="text-2xl font-heading font-bold mt-1.5 leading-none">{consumidoresAtivos.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground mt-2">com cadastro completo</p>
              </div>
              <div className="shrink-0 rounded-xl bg-sky-500/10 p-2.5">
                <Users className="h-5 w-5 text-sky-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Faturamento Total</p>
                <p className="text-2xl font-heading font-bold mt-1.5 leading-none">
                  {hasCampanha
                    ? faturamentoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">{hasCampanha ? "total da campanha" : "Nenhuma campanha ativa"}</p>
              </div>
              <div className="shrink-0 rounded-xl bg-emerald-500/10 p-2.5">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Faturamento PP</p>
                <p className="text-2xl font-heading font-bold mt-1.5 leading-none">
                  {hasCampanha
                    ? faturamentoPP.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">{hasCampanha ? "comissão acumulada" : "Nenhuma campanha ativa"}</p>
              </div>
              <div className="shrink-0 rounded-xl bg-violet-500/10 p-2.5">
                <Receipt className="h-5 w-5 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grupo 2 — dados do período filtrado */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pedidos</p>
                <p className="text-2xl font-heading font-bold mt-1.5 leading-none">
                  {hasCampanha ? totalPedidosPeriodo.toLocaleString("pt-BR") : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">{hasCampanha ? "no período selecionado" : "Nenhuma campanha ativa"}</p>
              </div>
              <div className="shrink-0 rounded-xl bg-primary/10 p-2.5">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ticket Médio</p>
                <p className="text-2xl font-heading font-bold mt-1.5 leading-none">
                  {hasCampanha && ticketMedio > 0
                    ? ticketMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">por pedido entregue</p>
              </div>
              <div className="shrink-0 rounded-xl bg-orange-500/10 p-2.5">
                <TrendingUp className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cupons</p>
                <p className="text-2xl font-heading font-bold mt-1.5 leading-none">
                  {hasCampanha ? cuponsValidados.toLocaleString("pt-BR") : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">{hasCampanha ? "gerados no período" : "Nenhuma campanha ativa"}</p>
              </div>
              <div className="shrink-0 rounded-xl bg-amber-500/10 p-2.5">
                <Ticket className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cancelamentos</p>
                <p className={`text-2xl font-heading font-bold mt-1.5 leading-none ${
                  !hasCampanha ? "" : taxaCancelamento > 15 ? "text-destructive" : taxaCancelamento > 8 ? "text-amber-500" : ""
                }`}>
                  {hasCampanha ? `${taxaCancelamento.toFixed(1)}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">dos pedidos cancelados</p>
              </div>
              <div className={`shrink-0 rounded-xl p-2.5 ${taxaCancelamento > 15 ? "bg-destructive/10" : "bg-amber-500/10"}`}>
                <TrendingDown className={`h-5 w-5 ${taxaCancelamento > 15 ? "text-destructive" : "text-amber-500"}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dias p/ Sorteio</p>
                {hasCampanha ? (
                  <>
                    <p className={`text-2xl font-heading font-bold mt-1.5 leading-none ${getSorteioColor()}`}>
                      {diasSorteio !== null && diasSorteio <= 0 ? "Encerrado" : diasSorteio ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {diasSorteio !== null && diasSorteio > 0 ? `data: ${dataSorteioStr}` : dataSorteioStr ?? ""}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-heading font-bold mt-1.5 leading-none">—</p>
                    <p className="text-xs text-muted-foreground mt-2">Nenhuma campanha ativa</p>
                  </>
                )}
              </div>
              <div className="shrink-0 rounded-xl bg-violet-500/10 p-2.5">
                <Trophy className="h-5 w-5 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de linha — controla o filtro de data de todo o dashboard */}
      <SalesChart onRangeChange={(from, to) => { setDateFrom(from); setDateTo(to); }} />

      {/* Gráficos — todos filtrados pelo período */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <CanalDonut data={canalData} />
        <PagamentoDonut data={pagamentoData} />
        <CidadeBarChart data={cidadeFaturamento} />
      </div>

      {/* Ranking + Mapa — filtrados pelo período */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-heading">
              <Trophy className="h-5 w-5 text-primary" /> Ranking Top 5 Pizzarias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {top5.length === 0 && <p className="text-sm text-muted-foreground">Sem pedidos no período.</p>}
            {top5.filter(p => p.vendas > 0).map((p) => (
              <div key={p.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {p.pos < 3 ? (
                      <Badge className={`${medalColors[p.pos]} text-xs px-1.5`}>{p.pos + 1}º</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground w-6 text-center">{p.pos + 1}º</span>
                    )}
                    <span className="font-medium text-sm">{p.nome}</span>
                    <span className="text-xs text-muted-foreground">— {p.cidade}</span>
                    {p.status !== "Ativa" && <Badge variant="secondary" className="text-[10px] px-1 py-0">{p.status}</Badge>}
                  </div>
                  <span className="text-sm font-heading font-bold text-primary">
                    {p.vendas.toLocaleString("pt-BR")} vendas
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${p.pct}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-heading">
              <MapPin className="h-5 w-5 text-primary" /> Vendas por Cidade e Bairro
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cityData.length === 0 && <p className="text-sm text-muted-foreground">Sem pedidos no período.</p>}
            <div className="space-y-1">
              {cityData.map((city) => (
                <Collapsible key={city.cidade} open={expandedCities.includes(city.cidade)} onOpenChange={() => toggleCity(city.cidade)}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      {expandedCities.includes(city.cidade) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <span className="font-medium">{city.cidade}</span>
                      <Badge variant="secondary" className="text-xs">{city.pizzarias} pizzarias</Badge>
                    </div>
                    <span className="font-heading font-bold text-primary">{city.vendas.toLocaleString("pt-BR")} vendas</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-9 border-l border-border pl-3 space-y-1 py-1">
                      {city.bairros.map((b) => (
                        <div key={b.bairro} className="flex items-center justify-between px-3 py-1.5 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{b.bairro}</span>
                            <span className="text-xs">({b.pizzarias})</span>
                          </div>
                          <span className="font-medium text-foreground">{b.vendas.toLocaleString("pt-BR")}</span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

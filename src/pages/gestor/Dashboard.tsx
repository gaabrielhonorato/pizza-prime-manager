import { useState, useMemo, useEffect } from "react";
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
  canal: string;
  forma_pagamento: string;
  pizzaria_id: string;
  status: string;
  valor_total: number;
}

export default function Dashboard() {
  const { pizzarias } = usePizzarias();
  const [totalVendas, setTotalVendas] = useState(0);
  const [faturamento, setFaturamento] = useState(0);
  const [metaFaturamento, setMetaFaturamento] = useState(0);
  const [diasSorteio, setDiasSorteio] = useState<number | null>(null);
  const [dataSorteioStr, setDataSorteioStr] = useState<string | null>(null);
  const [hasCampanha, setHasCampanha] = useState(true);
  const [cuponsValidados, setCuponsValidados] = useState(0);
  const [cuponsDisponiveis, setCuponsDisponiveis] = useState<number | null>(null);

  const [pedidosDetalhes, setPedidosDetalhes] = useState<PedidoDetalhe[]>([]);
  const [comissao, setComissao] = useState(0.15);
  const [consumidoresAtivos, setConsumidoresAtivos] = useState(0);

  const ativas = pizzarias.filter((p) => p.status === "Ativa").length;
  const pizzariasPct = Math.min((ativas / META_PIZZARIAS) * 100, 100);
  const faturamentoPct = metaFaturamento > 0 ? Math.min((faturamento / metaFaturamento) * 100, 100) : 0;

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
    const now = new Date();
    const diffMs = sorteioDate.getTime() - now.getTime();
    setDiasSorteio(Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    setDataSorteioStr(sorteioDate.toLocaleDateString("pt-BR"));

    const { data: pedidosData } = await supabase
      .from("pedidos")
      .select("valor_total, canal, forma_pagamento, pizzaria_id, status")
      .eq("campanha_id", campData.id);

    const somaValor = pedidosData?.reduce((s, p) => s + Number(p.valor_total), 0) ?? 0;
    setTotalVendas(pedidosData?.length ?? 0);
    setFaturamento(somaValor * comissaoDecimal);
    setPedidosDetalhes(
      (pedidosData ?? []).map((p: any) => ({
        canal: p.canal ?? "outros",
        forma_pagamento: p.forma_pagamento ?? "outros",
        pizzaria_id: p.pizzaria_id ?? "",
        status: p.status ?? "",
        valor_total: Number(p.valor_total),
      }))
    );

    const { data: cuponsData } = await supabase
      .from("cupons")
      .select("quantidade, status")
      .eq("campanha_id", campData.id);
    const validados = cuponsData?.filter(c => c.status === "validado" || c.status === "pendente").reduce((s, c) => s + c.quantidade, 0) ?? 0;
    setCuponsValidados(validados);

    const totalCupons = cuponsData?.reduce((s, c) => s + c.quantidade, 0) ?? 0;
    setMetaFaturamento(totalCupons * Number(campData.valor_por_cupom) * comissaoDecimal);

    const limiteConsumidor = (campData as any).limite_cupons_consumidor as number | null;
    const { count: consCount } = await supabase
      .from("consumidores")
      .select("*", { count: "exact", head: true })
      .eq("cadastro_completo", true);
    setConsumidoresAtivos(consCount ?? 0);
    if (limiteConsumidor) {
      setCuponsDisponiveis(limiteConsumidor * (consCount ?? 0));
    } else {
      setCuponsDisponiveis(null);
    }
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
    if (diasSorteio <= 0) return "text-destructive";
    if (diasSorteio < 7) return "text-destructive";
    if (diasSorteio <= 30) return "text-orange-500";
    return "text-green-600";
  };

  // Derived metrics
  const ticketMedio = useMemo(() => {
    const entregues = pedidosDetalhes.filter(p => p.status === "entregue");
    if (!entregues.length) return 0;
    return entregues.reduce((s, p) => s + p.valor_total, 0) / entregues.length;
  }, [pedidosDetalhes]);

  const taxaCancelamento = useMemo(() => {
    if (!pedidosDetalhes.length) return 0;
    return (pedidosDetalhes.filter(p => p.status === "cancelado").length / pedidosDetalhes.length) * 100;
  }, [pedidosDetalhes]);

  const canalData = useMemo(() => {
    const map = new Map<string, number>();
    pedidosDetalhes.forEach(p => { map.set(p.canal, (map.get(p.canal) ?? 0) + 1); });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [pedidosDetalhes]);

  const pagamentoData = useMemo(() => {
    const map = new Map<string, number>();
    pedidosDetalhes.forEach(p => { map.set(p.forma_pagamento, (map.get(p.forma_pagamento) ?? 0) + 1); });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [pedidosDetalhes]);

  const cidadeFaturamento = useMemo(() => {
    const map = new Map<string, number>();
    pedidosDetalhes.filter(p => p.status === "entregue").forEach(p => {
      const pizzaria = pizzarias.find(pz => pz.id === p.pizzaria_id);
      const cidade = pizzaria?.cidade ?? "Sem cidade";
      map.set(cidade, (map.get(cidade) ?? 0) + p.valor_total * comissao);
    });
    return [...map.entries()]
      .map(([cidade, faturamento]) => ({ cidade, faturamento }))
      .sort((a, b) => b.faturamento - a.faturamento)
      .slice(0, 7);
  }, [pedidosDetalhes, pizzarias, comissao]);

  const top5 = useMemo(() => {
    let pool = [...pizzarias];
    const hasAtivas = pool.some(p => p.status === "Ativa");
    if (hasAtivas) pool = pool.filter(p => p.status === "Ativa");
    const sorted = pool.sort((a, b) => (b.vendas ?? 0) - (a.vendas ?? 0)).slice(0, 5);
    const maxVendas = sorted[0]?.vendas || 1;
    return sorted.map((p, i) => ({ ...p, pos: i, pct: ((p.vendas ?? 0) / maxVendas) * 100 }));
  }, [pizzarias]);

  const cityData = useMemo(() => {
    const hasAtivas = pizzarias.some(p => p.status === "Ativa");
    const pool = hasAtivas ? pizzarias.filter(p => p.status === "Ativa") : pizzarias;
    const map = new Map<string, { pizzarias: number; vendas: number; bairros: Map<string, { pizzarias: number; vendas: number }> }>();
    for (const p of pool) {
      const city = p.cidade || "Sem cidade";
      const bairro = p.bairro || "Sem bairro";
      if (!map.has(city)) map.set(city, { pizzarias: 0, vendas: 0, bairros: new Map() });
      const c = map.get(city)!;
      c.pizzarias++;
      c.vendas += p.vendas ?? 0;
      if (!c.bairros.has(bairro)) c.bairros.set(bairro, { pizzarias: 0, vendas: 0 });
      const b = c.bairros.get(bairro)!;
      b.pizzarias++;
      b.vendas += p.vendas ?? 0;
    }
    return [...map.entries()]
      .map(([cidade, d]) => ({
        cidade,
        pizzarias: d.pizzarias,
        vendas: d.vendas,
        bairros: [...d.bairros.entries()]
          .map(([bairro, bd]) => ({ bairro, ...bd }))
          .sort((a, b) => b.vendas - a.vendas),
      }))
      .sort((a, b) => b.vendas - a.vendas);
  }, [pizzarias]);

  const [expandedCities, setExpandedCities] = useState<string[]>([]);
  const toggleCity = (c: string) =>
    setExpandedCities((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Visão geral da campanha ativa</p>
      </div>

      {/* KPI Principal — 5 cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total de Vendas</p>
                <p className="text-2xl font-heading font-bold mt-1.5 leading-none">
                  {hasCampanha ? totalVendas.toLocaleString("pt-BR") : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {hasCampanha ? "pedidos na promoção ativa" : "Nenhuma campanha ativa"}
                </p>
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Faturamento</p>
                <p className="text-2xl font-heading font-bold mt-1.5 leading-none">
                  {hasCampanha
                    ? faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {hasCampanha ? "comissão acumulada no ciclo" : "Nenhuma campanha ativa"}
                </p>
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dias p/ Sorteio</p>
                {hasCampanha ? (
                  <>
                    <p className={`text-2xl font-heading font-bold mt-1.5 leading-none ${getSorteioColor()}`}>
                      {diasSorteio !== null && diasSorteio <= 0 ? "Encerrado" : diasSorteio ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {diasSorteio !== null && diasSorteio > 0
                        ? `data: ${dataSorteioStr}`
                        : dataSorteioStr ?? ""}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-heading font-bold mt-1.5 leading-none">—</p>
                    <p className="text-xs text-muted-foreground mt-2">Nenhuma campanha ativa</p>
                  </>
                )}
              </div>
              <div className="shrink-0 rounded-xl bg-amber-500/10 p-2.5">
                <Trophy className="h-5 w-5 text-amber-500" />
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
                <p className="text-xs text-muted-foreground mt-2">
                  {!hasCampanha ? "Nenhuma campanha ativa" : "cupons entregues no ciclo"}
                </p>
              </div>
              <div className="shrink-0 rounded-xl bg-violet-500/10 p-2.5">
                <Ticket className="h-5 w-5 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Derivados — 3 cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
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
                <Receipt className="h-5 w-5 text-orange-500" />
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Consumidores Ativos</p>
                <p className="text-2xl font-heading font-bold mt-1.5 leading-none">
                  {consumidoresAtivos.toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-muted-foreground mt-2">com cadastro completo</p>
              </div>
              <div className="shrink-0 rounded-xl bg-sky-500/10 p-2.5">
                <Users className="h-5 w-5 text-sky-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <SalesChart />

      {/* Gráficos — donuts + barras */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <CanalDonut data={canalData} />
        <PagamentoDonut data={pagamentoData} />
        <CidadeBarChart data={cidadeFaturamento} />
      </div>

      {/* Ranking + Mapa de Cidades */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-heading">
              <Trophy className="h-5 w-5 text-primary" /> Ranking Top 5 Pizzarias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {top5.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pizzaria cadastrada.</p>}
            {top5.map((p) => (
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
                    {(p.vendas ?? 0).toLocaleString("pt-BR")} vendas
                  </span>
                </div>
                <Progress value={p.pct} className="h-2" />
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
            {cityData.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pizzaria cadastrada.</p>}
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

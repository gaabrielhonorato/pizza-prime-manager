import { useState, useMemo, useEffect } from "react";
import { Store, BarChart3, DollarSign, Trophy, Ticket, MapPin, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { usePizzarias } from "@/contexts/PizzariasContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SalesChart from "@/components/gestor/SalesChart";
import { supabase } from "@/integrations/supabase/client";

const META_PIZZARIAS = 40;

const medalColors: Record<number, string> = {
  0: "bg-yellow-500 text-black",
  1: "bg-gray-400 text-black",
  2: "bg-amber-700 text-white",
};

export default function Dashboard() {
  const { pizzarias } = usePizzarias();
  const [totalVendas, setTotalVendas] = useState(0);
  const [faturamento, setFaturamento] = useState(0);
  const [metaFaturamento, setMetaFaturamento] = useState(0);
  const [diasSorteio, setDiasSorteio] = useState<number | null>(null);
  const [dataSorteioStr, setDataSorteioStr] = useState<string | null>(null);
  const [hasCampanha, setHasCampanha] = useState(true);

  const ativas = pizzarias.filter((p) => p.status === "Ativa").length;
  const pizzariasPct = Math.min((ativas / META_PIZZARIAS) * 100, 100);
  const faturamentoPct = metaFaturamento > 0 ? Math.min((faturamento / metaFaturamento) * 100, 100) : 0;

  useEffect(() => {
    const fetchData = async () => {
      // Fetch active campaign
      const { data: campData } = await supabase
        .from("campanhas")
        .select("id, data_sorteio, valor_por_cupom")
        .eq("status", "ativa")
        .order("criado_em", { ascending: false })
        .limit(1)
        .single();

      if (!campData) {
        setHasCampanha(false);
        return;
      }

      // Days until sorteio
      const sorteioDate = new Date(campData.data_sorteio);
      const now = new Date();
      const diffMs = sorteioDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      setDiasSorteio(diffDays);
      setDataSorteioStr(sorteioDate.toLocaleDateString("pt-BR"));

      // Total vendas (pedidos entregues)
      const { data: pedidosData } = await supabase
        .from("pedidos")
        .select("valor_total")
        .eq("campanha_id", campData.id)
        .eq("status", "entregue");

      const totalPedidos = pedidosData?.length ?? 0;
      const somaValor = pedidosData?.reduce((s, p) => s + Number(p.valor_total), 0) ?? 0;
      setTotalVendas(totalPedidos);
      setFaturamento(somaValor * 0.15);

      // Meta projetada: total cupons gerados × valor_por_cupom × 15%
      const { data: cuponsData } = await supabase
        .from("cupons")
        .select("quantidade")
        .eq("campanha_id", campData.id);
      const totalCupons = cuponsData?.reduce((s, c) => s + c.quantidade, 0) ?? 0;
      setMetaFaturamento(totalCupons * Number(campData.valor_por_cupom) * 0.15);
    };
    fetchData();
  }, []);

  // Sorteio color
  const getSorteioColor = () => {
    if (diasSorteio === null) return "text-foreground";
    if (diasSorteio <= 0) return "text-destructive";
    if (diasSorteio < 7) return "text-destructive";
    if (diasSorteio <= 30) return "text-orange-500";
    return "text-green-600";
  };

  const top5 = useMemo(() => {
    const sorted = [...pizzarias]
      .filter((p) => p.status === "Ativa")
      .sort((a, b) => (b.vendas ?? 0) - (a.vendas ?? 0))
      .slice(0, 5);
    const maxVendas = sorted[0]?.vendas || 1;
    return sorted.map((p, i) => ({ ...p, pos: i, pct: ((p.vendas ?? 0) / maxVendas) * 100 }));
  }, [pizzarias]);

  const cityData = useMemo(() => {
    const map = new Map<string, { pizzarias: number; vendas: number; bairros: Map<string, { pizzarias: number; vendas: number }> }>();
    for (const p of pizzarias.filter((p) => p.status === "Ativa")) {
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
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1 — Pizzarias Ativas */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pizzarias Ativas</CardTitle>
            <Store className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-heading font-bold">{ativas}</div>
            <p className="mt-1 text-xs text-muted-foreground">de {META_PIZZARIAS} na meta do ciclo</p>
            <Progress value={pizzariasPct} className="mt-2 h-2 [&>div]:bg-orange-500" />
          </CardContent>
        </Card>

        {/* Card 2 — Total de Vendas */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Vendas</CardTitle>
            <BarChart3 className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-heading font-bold">{hasCampanha ? totalVendas.toLocaleString("pt-BR") : "—"}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasCampanha ? "pedidos na promoção ativa" : "Nenhuma campanha ativa"}
            </p>
          </CardContent>
        </Card>

        {/* Card 3 — Faturamento até hoje */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento até hoje</CardTitle>
            <DollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-heading font-bold">
              {hasCampanha
                ? faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                : "—"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasCampanha
                ? `de ${metaFaturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} projetados`
                : "Nenhuma campanha ativa"}
            </p>
            {hasCampanha && metaFaturamento > 0 && (
              <Progress value={faturamentoPct} className="mt-2 h-2 [&>div]:bg-orange-500" />
            )}
          </CardContent>
        </Card>

        {/* Card 4 — Dias para o Sorteio */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dias para o Sorteio</CardTitle>
            <Trophy className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {hasCampanha ? (
              <>
                <div className={`text-2xl font-heading font-bold ${getSorteioColor()}`}>
                  {diasSorteio !== null && diasSorteio <= 0 ? "Sorteio encerrado" : diasSorteio ?? "—"}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {diasSorteio !== null && diasSorteio > 0
                    ? `dias para o sorteio · ${dataSorteioStr}`
                    : diasSorteio !== null && diasSorteio <= 0
                    ? dataSorteioStr
                    : ""}
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-heading font-bold">—</div>
                <p className="mt-1 text-xs text-muted-foreground">Nenhuma campanha ativa</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <SalesChart />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-heading">
              <Trophy className="h-5 w-5 text-primary" /> Ranking Top 5 Pizzarias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {top5.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pizzaria ativa.</p>}
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

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-heading">
              <MapPin className="h-5 w-5 text-primary" /> Vendas por Cidade e Bairro
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cityData.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pizzaria ativa.</p>}
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

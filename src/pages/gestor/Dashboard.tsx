import { useState, useMemo } from "react";
import { Store, CheckCircle, DollarSign, TrendingUp, Target, Trophy, MapPin, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  VALOR_MATRICULA,
  META_PIZZARIAS,
  VENDAS_ESTIMADAS_CICLO,
  PERCENTUAL_VENDAS,
  PERCENTUAL_ANUNCIOS,
  CUSTO_CARDAPIO_WEB,
  CUSTO_CAPTACAO,
  CUSTO_EMBALAGEM_UNIDADE,
  TOTAL_EMBALAGENS_ESTIMADO,
  premios,
} from "@/data/mockData";
import { usePizzarias } from "@/contexts/PizzariasContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SalesChart from "@/components/gestor/SalesChart";

/* ───────── helpers ───────── */
const medalColors: Record<number, string> = {
  0: "bg-yellow-500 text-black",
  1: "bg-gray-400 text-black",
  2: "bg-amber-700 text-white",
};

/* ───────── Component ───────── */
export default function Dashboard() {
  const { pizzarias } = usePizzarias();

  /* ── KPI cards ── */
  const total = pizzarias.length;
  const ativas = pizzarias.filter((p) => p.status === "Ativa").length;
  const matriculasPagas = pizzarias.filter((p) => p.matriculaPaga).length;
  const receitaMatriculas = matriculasPagas * VALOR_MATRICULA;
  const receitaVendas = VENDAS_ESTIMADAS_CICLO * PERCENTUAL_VENDAS;
  const faturamento = receitaMatriculas + receitaVendas;

  const custoPremios = premios.reduce((s, p) => s + p.valor, 0);
  const custoAnuncios = faturamento * PERCENTUAL_ANUNCIOS;
  const custoCardapio = ativas * CUSTO_CARDAPIO_WEB;
  const custoEmbalagens = TOTAL_EMBALAGENS_ESTIMADO * CUSTO_EMBALAGEM_UNIDADE;
  const custoTotal = custoPremios + custoAnuncios + custoCardapio + CUSTO_CAPTACAO + custoEmbalagens;
  const lucro = faturamento - custoTotal;

  const cards = [
    { title: "Pizzarias Cadastradas", value: `${total} / ${META_PIZZARIAS}`, icon: Store, extra: <Progress value={(total / META_PIZZARIAS) * 100} className="mt-2 h-2" /> },
    { title: "Pizzarias Ativas", value: ativas, icon: CheckCircle },
    { title: "Receita de Matrículas", value: `R$ ${receitaMatriculas.toLocaleString("pt-BR")}`, subtitle: `${matriculasPagas} matrículas × R$ ${VALOR_MATRICULA}`, icon: DollarSign },
    { title: "Faturamento do Ciclo", value: `R$ ${faturamento.toLocaleString("pt-BR")}`, icon: TrendingUp },
    { title: "Lucro Projetado", value: `R$ ${lucro.toLocaleString("pt-BR")}`, icon: Target, highlight: lucro > 0 },
  ];

  /* ── Sales chart ── */
  const [selectedCanais, setSelectedCanais] = useState<CanalVenda[]>([...CANAIS_VENDA]);
  const allSelected = selectedCanais.length === CANAIS_VENDA.length;

  const toggleCanal = (c: CanalVenda) => {
    setSelectedCanais((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const toggleAll = () => {
    setSelectedCanais(allSelected ? [] : [...CANAIS_VENDA]);
  };

  const chartData = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of vendasDiarias) {
      if (selectedCanais.includes(r.canal)) {
        map.set(r.dia, (map.get(r.dia) || 0) + r.vendas);
      }
    }
    return Array.from({ length: 31 }, (_, i) => ({
      dia: i + 1,
      vendas: map.get(i + 1) || 0,
    }));
  }, [selectedCanais]);

  const chartConfig = {
    vendas: { label: "Vendas", color: "hsl(25 95% 53%)" },
  };

  /* ── Top 5 Ranking ── */
  const top5 = useMemo(() => {
    const sorted = [...pizzarias]
      .filter((p) => p.status === "Ativa")
      .sort((a, b) => (b.vendas ?? 0) - (a.vendas ?? 0))
      .slice(0, 5);
    const maxVendas = sorted[0]?.vendas || 1;
    return sorted.map((p, i) => ({ ...p, pos: i, pct: ((p.vendas ?? 0) / maxVendas) * 100 }));
  }, [pizzarias]);

  /* ── Sales by City / Bairro ── */
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

      {/* BLOCO 1 — KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.title} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.highlight ? "text-success" : "text-primary"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-heading font-bold ${c.highlight ? "text-success" : ""}`}>{c.value}</div>
              {c.subtitle && <p className="mt-1 text-xs text-muted-foreground">{c.subtitle}</p>}
              {c.extra}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* BLOCO 2 — Sales Line Chart */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-heading">📈 Vendas Diárias</CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                {allSelected ? "Todos os canais" : `${selectedCanais.length} canal(is)`}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="end">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  Todos os canais
                </label>
                <div className="h-px bg-border my-1" />
                {CANAIS_VENDA.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedCanais.includes(c)}
                      onCheckedChange={() => toggleCanal(c)}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
              <XAxis dataKey="dia" stroke="hsl(220 10% 55%)" fontSize={12} />
              <YAxis stroke="hsl(220 10% 55%)" fontSize={12} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="vendas"
                stroke="hsl(25 95% 53%)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(25 95% 53%)" }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* BLOCO 3 — Ranking + City Sales */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Ranking Top 5 */}
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
                      <Badge className={`${medalColors[p.pos]} text-xs px-1.5`}>
                        {p.pos + 1}º
                      </Badge>
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

        {/* Vendas por Cidade e Bairro */}
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
                <Collapsible
                  key={city.cidade}
                  open={expandedCities.includes(city.cidade)}
                  onOpenChange={() => toggleCity(city.cidade)}
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      {expandedCities.includes(city.cidade) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{city.cidade}</span>
                      <Badge variant="secondary" className="text-xs">{city.pizzarias} pizzarias</Badge>
                    </div>
                    <span className="font-heading font-bold text-primary">
                      {city.vendas.toLocaleString("pt-BR")} vendas
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-9 border-l border-border pl-3 space-y-1 py-1">
                      {city.bairros.map((b) => (
                        <div key={b.bairro} className="flex items-center justify-between px-3 py-1.5 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{b.bairro}</span>
                            <span className="text-xs">({b.pizzarias})</span>
                          </div>
                          <span className="font-medium text-foreground">
                            {b.vendas.toLocaleString("pt-BR")}
                          </span>
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

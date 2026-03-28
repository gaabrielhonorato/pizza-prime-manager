import { useState, useMemo, useEffect } from "react";
import { Store, CheckCircle, Truck, Users, Ticket, Trophy, MapPin, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { usePizzarias } from "@/contexts/PizzariasContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SalesChart from "@/components/gestor/SalesChart";
import { supabase } from "@/integrations/supabase/client";

const medalColors: Record<number, string> = {
  0: "bg-yellow-500 text-black",
  1: "bg-gray-400 text-black",
  2: "bg-amber-700 text-white",
};

export default function Dashboard() {
  const { pizzarias } = usePizzarias();
  const [entregadoresAtivos, setEntregadoresAtivos] = useState(0);
  const [consumidoresAtivos, setConsumidoresAtivos] = useState(0);
  const [cuponsAtivos, setCuponsAtivos] = useState(0);
  const [limiteCuponsCiclo, setLimiteCuponsCiclo] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch active entregadores
      const { count: entCount } = await supabase
        .from("entregadores")
        .select("*", { count: "exact", head: true })
        .eq("disponivel", true);
      setEntregadoresAtivos(entCount ?? 0);

      // Fetch active consumidores (cadastro completo)
      const { count: consCount } = await supabase
        .from("consumidores")
        .select("*", { count: "exact", head: true })
        .eq("cadastro_completo", true);
      setConsumidoresAtivos(consCount ?? 0);

      // Fetch active campaign cupons limit
      const { data: campData } = await supabase
        .from("campanhas")
        .select("id, limite_cupons_ciclo")
        .eq("status", "ativa")
        .limit(1)
        .single();

      if (campData) {
        setLimiteCuponsCiclo((campData as any).limite_cupons_ciclo ?? null);

        // Fetch total cupons for this campaign
        const { data: cuponsData } = await supabase
          .from("cupons")
          .select("quantidade")
          .eq("campanha_id", campData.id);
        const totalCupons = cuponsData?.reduce((s, c) => s + c.quantidade, 0) ?? 0;
        setCuponsAtivos(totalCupons);
      }
    };
    fetchData();
  }, []);

  const total = pizzarias.length;
  const ativas = pizzarias.filter((p) => p.status === "Ativa").length;
  const cuponsPct = limiteCuponsCiclo && limiteCuponsCiclo > 0 ? Math.min((cuponsAtivos / limiteCuponsCiclo) * 100, 100) : null;

  const cards = [
    { title: "Pizzarias Cadastradas", value: total, icon: Store },
    { title: "Pizzarias Ativas", value: ativas, icon: CheckCircle },
    { title: "Entregadores Ativos", value: entregadoresAtivos, icon: Truck },
    { title: "Consumidores Ativos", value: consumidoresAtivos, icon: Users },
    {
      title: "Cupons Ativos",
      value: limiteCuponsCiclo ? `${cuponsAtivos.toLocaleString("pt-BR")} / ${limiteCuponsCiclo.toLocaleString("pt-BR")}` : cuponsAtivos.toLocaleString("pt-BR"),
      icon: Ticket,
      extra: cuponsPct !== null ? <Progress value={cuponsPct} className="mt-2 h-2" /> : undefined,
      subtitle: cuponsPct !== null ? `${cuponsPct.toFixed(1)}% dos cupons entregues` : undefined,
    },
  ];

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.title} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-heading font-bold">{c.value}</div>
              {"subtitle" in c && c.subtitle && <p className="mt-1 text-xs text-muted-foreground">{c.subtitle}</p>}
              {"extra" in c && c.extra}
            </CardContent>
          </Card>
        ))}
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

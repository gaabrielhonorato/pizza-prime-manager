import { Store, CheckCircle, DollarSign, TrendingUp, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

export default function Dashboard() {
  const { pizzarias } = usePizzarias();

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

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold">Dashboard</h1>
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
    </div>
  );
}

import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  pizzarias, premios, VALOR_MATRICULA, VENDAS_ESTIMADAS_CICLO,
  PERCENTUAL_VENDAS, PERCENTUAL_ANUNCIOS, CUSTO_CARDAPIO_WEB,
  CUSTO_CAPTACAO, CUSTO_EMBALAGEM_UNIDADE, TOTAL_EMBALAGENS_ESTIMADO,
} from "@/data/mockData";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function Financeiro() {
  const ativas = pizzarias.filter((p) => p.status === "Ativa").length;
  const matriculasPagas = pizzarias.filter((p) => p.matriculaPaga).length;

  const receitaMatriculas = matriculasPagas * VALOR_MATRICULA;
  const receitaVendas = VENDAS_ESTIMADAS_CICLO * PERCENTUAL_VENDAS;
  const totalReceitas = receitaMatriculas + receitaVendas;

  const custoPremios = premios.reduce((s, p) => s + p.valor, 0);
  const custoAnuncios = totalReceitas * PERCENTUAL_ANUNCIOS;
  const custoCardapio = ativas * CUSTO_CARDAPIO_WEB;
  const custoEmbalagens = TOTAL_EMBALAGENS_ESTIMADO * CUSTO_EMBALAGEM_UNIDADE;
  const totalCustos = custoPremios + custoAnuncios + custoCardapio + CUSTO_CAPTACAO + custoEmbalagens;

  const lucro = totalReceitas - totalCustos;

  const receitas = [
    { item: `Matrículas (${matriculasPagas} × R$ ${VALOR_MATRICULA})`, valor: receitaMatriculas },
    { item: `15% sobre vendas (R$ ${VENDAS_ESTIMADAS_CICLO.toLocaleString("pt-BR")})`, valor: receitaVendas },
  ];

  const custos = [
    { item: `Prêmios (1º + 2º + 3º)`, valor: custoPremios },
    { item: `Anúncios (30% do faturamento)`, valor: custoAnuncios },
    { item: `CardápioWeb (${ativas} pizzarias × R$ ${CUSTO_CARDAPIO_WEB})`, valor: custoCardapio },
    { item: `Captação`, valor: CUSTO_CAPTACAO },
    { item: `Embalagens (${TOTAL_EMBALAGENS_ESTIMADO.toLocaleString("pt-BR")} × R$ ${CUSTO_EMBALAGEM_UNIDADE.toFixed(2)})`, valor: custoEmbalagens },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-bold">Financeiro</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <TrendingUp className="h-5 w-5 text-success" />
            <CardTitle className="text-sm text-muted-foreground">Total Receitas</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold text-success">{fmt(totalReceitas)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            <CardTitle className="text-sm text-muted-foreground">Total Custos</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold text-destructive">{fmt(totalCustos)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm text-muted-foreground">Lucro Final</CardTitle>
          </CardHeader>
          <CardContent><p className={`text-2xl font-heading font-bold ${lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmt(lucro)}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="font-heading text-success">Receitas</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {receitas.map((r) => (
                  <TableRow key={r.item}><TableCell>{r.item}</TableCell><TableCell className="text-right font-medium">{fmt(r.valor)}</TableCell></TableRow>
                ))}
                <TableRow className="border-t-2 border-primary">
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold text-success">{fmt(totalReceitas)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="font-heading text-destructive">Custos</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {custos.map((c) => (
                  <TableRow key={c.item}><TableCell>{c.item}</TableCell><TableCell className="text-right font-medium">{fmt(c.valor)}</TableCell></TableRow>
                ))}
                <TableRow className="border-t-2 border-primary">
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold text-destructive">{fmt(totalCustos)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

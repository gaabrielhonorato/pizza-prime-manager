import { useState } from "react";
import { DollarSign, TrendingUp, Clock, CreditCard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function statusBadge(s: string) {
  const cls = s === "Pago"
    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    : s === "Processando"
    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
    : "bg-muted text-muted-foreground border-border";
  return <Badge variant="outline" className={cls}>{s}</Badge>;
}

const cicloData = [
  { mes: "Janeiro/2026", vendas: 16200, taxa: 2430, repasse: 13770, status: "Pago" },
  { mes: "Fevereiro/2026", vendas: 17800, taxa: 2670, repasse: 15130, status: "Pago" },
  { mes: "Março/2026", vendas: 18450, taxa: 2768, repasse: 15683, status: "Processando" },
  { mes: "Abril/2026", vendas: 0, taxa: 0, repasse: 0, status: "Pendente" },
];

const historicoRepasses = [
  { data: "05/03/2026", periodo: "Fevereiro/2026", bruto: 17800, liquido: 15130, status: "Pago", comprovante: true },
  { data: "05/02/2026", periodo: "Janeiro/2026", bruto: 16200, liquido: 13770, status: "Pago", comprovante: true },
  { data: "05/12/2025", periodo: "Novembro/2025", bruto: 14500, liquido: 12325, status: "Pago", comprovante: true },
  { data: "05/11/2025", periodo: "Outubro/2025", bruto: 13200, liquido: 11220, status: "Pago", comprovante: true },
];

export default function PizzariaFinanceiro() {
  const totalVendido = cicloData.reduce((s, r) => s + r.vendas, 0);
  const totalRepasses = historicoRepasses.reduce((s, r) => s + r.liquido, 0);

  const kpis = [
    { label: "Total vendido no ciclo", value: `R$ ${totalVendido.toLocaleString("pt-BR")}`, icon: DollarSign },
    { label: "Repasses recebidos", value: `R$ ${totalRepasses.toLocaleString("pt-BR")}`, icon: TrendingUp },
    { label: "Próximo repasse previsto", value: "05/04/2026", icon: Clock },
    { label: "Repasse pendente", value: `R$ ${cicloData.find((r) => r.status === "Processando")?.repasse.toLocaleString("pt-BR") ?? "0"}`, icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">💰 Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-1">Acompanhe vendas, repasses e histórico financeiro.</p>
      </div>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="resumo" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Resumo</TabsTrigger>
          <TabsTrigger value="historico" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Histórico de Repasses</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <Card key={k.label} className="border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
                  <k.icon className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{k.value}</p></CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base">Ciclo Atual</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Total de Vendas</TableHead>
                    <TableHead className="text-right">15% Pizza Premiada</TableHead>
                    <TableHead className="text-right">85% Repasse</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cicloData.map((r) => (
                    <TableRow key={r.mes}>
                      <TableCell className="font-medium">{r.mes}</TableCell>
                      <TableCell className="text-right">R$ {r.vendas.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right text-muted-foreground">R$ {r.taxa.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right font-medium">R$ {r.repasse.toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base">Histórico de Repasses</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Valor Bruto</TableHead>
                    <TableHead className="text-right">Valor Líquido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Comprovante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicoRepasses.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{r.data}</TableCell>
                      <TableCell className="text-xs">{r.periodo}</TableCell>
                      <TableCell className="text-right">R$ {r.bruto.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right font-medium">R$ {r.liquido.toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-right">
                        {r.comprovante && <Button variant="ghost" size="sm" className="text-xs text-primary">Ver</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

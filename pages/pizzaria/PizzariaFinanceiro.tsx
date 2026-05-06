import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, Clock, CreditCard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useMinhaPizzaria } from "@/contexts/MinhaPizzariaContext";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

function statusBadge(s: string) {
  const lower = s.toLowerCase();
  const cls = lower === "pago"
    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    : lower === "processando"
    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
    : "bg-muted text-muted-foreground border-border";
  return <Badge variant="outline" className={cls}>{s}</Badge>;
}

interface RepasseRow {
  id: string;
  periodoInicio: string;
  periodoFim: string;
  valorBruto: number;
  percentual: number;
  valorPizzaPremiada: number;
  valorRepasse: number;
  dataPagamento: string | null;
  status: string;
}

export default function PizzariaFinanceiro() {
  const { pizzaria } = useMinhaPizzaria();
  const [repasses, setRepasses] = useState<RepasseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pizzaria) return;
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("repasses")
        .select("*")
        .eq("pizzaria_id", pizzaria.id)
        .order("periodo_inicio", { ascending: false });

      if (error) {
        console.error("Error fetching repasses:", error);
        setLoading(false);
        return;
      }

      setRepasses((data ?? []).map((r: any) => ({
        id: r.id,
        periodoInicio: r.periodo_inicio,
        periodoFim: r.periodo_fim,
        valorBruto: Number(r.valor_bruto),
        percentual: Number(r.percentual_pizza_premiada),
        valorPizzaPremiada: Number(r.valor_pizza_premiada),
        valorRepasse: Number(r.valor_repasse),
        dataPagamento: r.data_pagamento,
        status: r.status,
      })));
      setLoading(false);
    };
    fetch();
  }, [pizzaria]);

  const totalVendido = repasses.reduce((s, r) => s + r.valorBruto, 0);
  const totalRepasses = repasses.filter(r => r.status === "pago").reduce((s, r) => s + r.valorRepasse, 0);
  const pendente = repasses.find(r => r.status === "processando" || r.status === "pendente");
  const ultimoPago = repasses.find(r => r.status === "pago");
  const proximoRepasse = ultimoPago
    ? format(addMonths(new Date(ultimoPago.periodoFim), 1), "dd/MM/yyyy")
    : "—";

  const kpis = [
    { label: "Total vendido", value: `R$ ${totalVendido.toLocaleString("pt-BR")}`, icon: DollarSign },
    { label: "Repasses recebidos", value: `R$ ${totalRepasses.toLocaleString("pt-BR")}`, icon: TrendingUp },
    { label: "Próximo repasse previsto", value: proximoRepasse, icon: Clock },
    { label: "Repasse pendente", value: `R$ ${(pendente?.valorRepasse ?? 0).toLocaleString("pt-BR")}`, icon: CreditCard },
  ];

  const formatPeriodo = (inicio: string, fim: string) => {
    try {
      return format(new Date(inicio), "MMMM/yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());
    } catch {
      return `${inicio} - ${fim}`;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">💰 Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-1">Acompanhe vendas, repasses e histórico financeiro.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando dados financeiros...</div>
      ) : (
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
              <CardHeader><CardTitle className="text-base">Repasses</CardTitle></CardHeader>
              <CardContent className="p-0">
                {repasses.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">Nenhum repasse registrado ainda.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Total de Vendas</TableHead>
                        <TableHead className="text-right">% Pizza Premiada</TableHead>
                        <TableHead className="text-right">Repasse</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repasses.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{formatPeriodo(r.periodoInicio, r.periodoFim)}</TableCell>
                          <TableCell className="text-right">R$ {r.valorBruto.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right text-muted-foreground">R$ {r.valorPizzaPremiada.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right font-medium">R$ {r.valorRepasse.toLocaleString("pt-BR")}</TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <Card className="border-border bg-card">
              <CardHeader><CardTitle className="text-base">Histórico de Repasses</CardTitle></CardHeader>
              <CardContent className="p-0">
                {repasses.filter(r => r.status === "pago").length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">Nenhum repasse pago ainda.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data Pgto</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Valor Bruto</TableHead>
                        <TableHead className="text-right">Valor Líquido</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repasses.filter(r => r.status === "pago").map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{r.dataPagamento ? format(new Date(r.dataPagamento), "dd/MM/yyyy") : "—"}</TableCell>
                          <TableCell className="text-xs">{formatPeriodo(r.periodoInicio, r.periodoFim)}</TableCell>
                          <TableCell className="text-right">R$ {r.valorBruto.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right font-medium">R$ {r.valorRepasse.toLocaleString("pt-BR")}</TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

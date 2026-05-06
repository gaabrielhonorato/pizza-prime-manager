import { useMemo, useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { TrendingUp, TrendingDown, DollarSign, Percent, BarChart3, Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import ExportButton from "@/components/gestor/ExportButton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

interface ContextType { selectedCampanha: string; periodo: string; }

export default function FinanceiroVisaoGeral() {
  const { selectedCampanha } = useOutletContext<ContextType>();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pizzarias, setPizzarias] = useState<any[]>([]);
  const [custosOp, setCustosOp] = useState<any[]>([]);
  const [custosLeg, setCustosLeg] = useState<any[]>([]);
  const [comissao, setComissao] = useState(15);
  const [valorAdesao, setValorAdesao] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);

      // Get campaign commission rate
      let campId = selectedCampanha;
      if (campId === "todas") {
        const { data: cp } = await supabase.from("campanhas").select("id, percentual_comissao, valor_adesao").eq("is_principal", true).limit(1).single();
        campId = cp?.id ?? "";
        setComissao(Number(cp?.percentual_comissao ?? 15));
        setValorAdesao(Number(cp?.valor_adesao ?? 0));
      } else {
        const { data: cp } = await supabase.from("campanhas").select("percentual_comissao, valor_adesao").eq("id", campId).single();
        setComissao(Number(cp?.percentual_comissao ?? 15));
        setValorAdesao(Number(cp?.valor_adesao ?? 0));
      }

      let pedQ = supabase.from("pedidos").select("valor_total, data_pedido, campanha_id");
      if (selectedCampanha !== "todas") pedQ = pedQ.eq("campanha_id", selectedCampanha);
      const { data: p } = await pedQ;

      const { data: pz } = await supabase.from("pizzarias").select("id, nome, matricula_paga");
      
      let coQ = supabase.from("custos_operacionais").select("*");
      if (selectedCampanha !== "todas") coQ = coQ.eq("campanha_id", selectedCampanha);
      const { data: co } = await coQ;

      let clQ = supabase.from("custos").select("*");
      if (selectedCampanha !== "todas") clQ = clQ.eq("campanha_id", selectedCampanha);
      const { data: cl } = await clQ;

      setPedidos(p ?? []);
      setPizzarias(pz ?? []);
      setCustosOp(co ?? []);
      setCustosLeg(cl ?? []);
      setLoading(false);
    };
    fetch();
  }, [selectedCampanha]);

  const pctDecimal = comissao / 100;

  const stats = useMemo(() => {
    const totalVendas = pedidos.reduce((s, p) => s + Number(p.valor_total), 0);
    const matriculasCount = pizzarias.filter(p => p.matricula_paga).length;
    const matriculasValor = matriculasCount * (valorAdesao > 0 ? valorAdesao : 799);
    const fatPP = totalVendas * pctDecimal;
    const fatTotal = fatPP + matriculasValor;
    const fatPizzarias = totalVendas * (1 - pctDecimal);
    const totalCustosOp = custosOp.reduce((s, c) => s + Number(c.valor_total_calculado), 0);
    const totalCustosLeg = custosLeg.reduce((s, c) => s + Number(c.valor), 0);
    const totalCustos = totalCustosOp + totalCustosLeg;
    const lucro = fatTotal - totalCustos;
    const margem = fatTotal > 0 ? (lucro / fatTotal) * 100 : 0;
    return { fatTotal, fatPP, fatPizzarias, totalCustos, lucro, margem, matriculasValor };
  }, [pedidos, pizzarias, custosOp, custosLeg, pctDecimal, valorAdesao]);

  const chartData = useMemo(() => {
    const byMonth: Record<string, { vendas: number }> = {};
    pedidos.forEach(p => {
      const m = new Date(p.data_pedido).toISOString().slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { vendas: 0 };
      byMonth[m].vendas += Number(p.valor_total);
    });
    const totalCustosMes = stats.totalCustos / Math.max(Object.keys(byMonth).length, 1);
    return Object.entries(byMonth).sort().map(([mes, d]) => {
      const recPP = d.vendas * pctDecimal;
      return { mes: mes.split("-").reverse().join("/"), receita: recPP, custos: totalCustosMes, lucro: recPP - totalCustosMes };
    });
  }, [pedidos, stats.totalCustos, pctDecimal]);

  const tableData = useMemo(() => {
    const byMonth: Record<string, number> = {};
    pedidos.forEach(p => {
      const m = new Date(p.data_pedido).toISOString().slice(0, 7);
      byMonth[m] = (byMonth[m] || 0) + Number(p.valor_total);
    });
    const months = Object.keys(byMonth).sort();
    const custoMes = stats.totalCustos / Math.max(months.length, 1);
    return months.map(m => {
      const v = byMonth[m];
      const pp = v * pctDecimal;
      const pz = v * (1 - pctDecimal);
      const lucro = pp - custoMes;
      return { mes: m.split("-").reverse().join("/"), fatTotal: v, fatPP: pp, fatPizzarias: pz, custos: custoMes, lucro, margem: pp > 0 ? (lucro / pp) * 100 : 0 };
    });
  }, [pedidos, stats.totalCustos, pctDecimal]);

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;

  const cards = [
    { label: `Faturamento Total (${comissao}% + Adesões)`, value: fmt(stats.fatTotal), icon: Landmark, color: "text-primary" },
    { label: `Receita Vendas (${comissao}%)`, value: fmt(stats.fatPP), icon: TrendingUp, color: "text-success" },
    { label: `Faturamento Pizzarias (${100 - comissao}%)`, value: fmt(stats.fatPizzarias), icon: BarChart3, color: "text-muted-foreground" },
    { label: "Total de Custos", value: fmt(stats.totalCustos), icon: TrendingDown, color: "text-destructive" },
    { label: "Lucro Líquido", value: fmt(stats.lucro), icon: DollarSign, color: stats.lucro >= 0 ? "text-success" : "text-destructive" },
    { label: "Margem %", value: fmtPct(stats.margem), icon: Percent, color: stats.margem >= 0 ? "text-success" : "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Visão Geral</h1>
        <ExportButton
          data={tableData.map(r => ({ ...r, fatTotal: fmt(r.fatTotal), fatPP: fmt(r.fatPP), fatPizzarias: fmt(r.fatPizzarias), custos: fmt(r.custos), lucro: fmt(r.lucro), margem: fmtPct(r.margem) }))}
          columns={[
            { key: "mes", label: "Mês" }, { key: "fatTotal", label: "Faturamento Total" },
            { key: "fatPP", label: "Fat. PP (15%)" }, { key: "fatPizzarias", label: "Fat. Pizzarias (85%)" },
            { key: "custos", label: "Custos" }, { key: "lucro", label: "Lucro" }, { key: "margem", label: "Margem %" },
          ]}
          fileName="financeiro-visao-geral"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(c => (
          <Card key={c.label} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <c.icon className={`h-5 w-5 ${c.color}`} />
              <CardTitle className="text-sm text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent><p className={`text-2xl font-heading font-bold ${c.color}`}>{c.value}</p></CardContent>
          </Card>
        ))}
      </div>

      {chartData.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="font-heading">Receitas vs Custos vs Lucro</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Line type="monotone" dataKey="receita" name="Receita PP" stroke="hsl(var(--success))" strokeWidth={2} />
                <Line type="monotone" dataKey="custos" name="Custos" stroke="hsl(var(--destructive))" strokeWidth={2} />
                <Line type="monotone" dataKey="lucro" name="Lucro" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="font-heading">Resumo Mensal</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead><TableHead className="text-right">Fat. Total</TableHead>
                <TableHead className="text-right">Fat. PP (15%)</TableHead><TableHead className="text-right">Fat. Pizzarias (85%)</TableHead>
                <TableHead className="text-right">Custos</TableHead><TableHead className="text-right">Lucro</TableHead>
                <TableHead className="text-right">Margem %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map(r => (
                <TableRow key={r.mes}>
                  <TableCell>{r.mes}</TableCell>
                  <TableCell className="text-right">{fmt(r.fatTotal)}</TableCell>
                  <TableCell className="text-right">{fmt(r.fatPP)}</TableCell>
                  <TableCell className="text-right">{fmt(r.fatPizzarias)}</TableCell>
                  <TableCell className="text-right">{fmt(r.custos)}</TableCell>
                  <TableCell className={`text-right font-medium ${r.lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmt(r.lucro)}</TableCell>
                  <TableCell className={`text-right ${r.margem >= 0 ? "text-success" : "text-destructive"}`}>{fmtPct(r.margem)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-bold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{fmt(stats.fatTotal)}</TableCell>
                <TableCell className="text-right">{fmt(stats.fatPP)}</TableCell>
                <TableCell className="text-right">{fmt(stats.fatPizzarias)}</TableCell>
                <TableCell className="text-right">{fmt(stats.totalCustos)}</TableCell>
                <TableCell className={`text-right ${stats.lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmt(stats.lucro)}</TableCell>
                <TableCell className={`text-right ${stats.margem >= 0 ? "text-success" : "text-destructive"}`}>{fmtPct(stats.margem)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
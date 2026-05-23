import { useMemo, useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { TrendingUp, TrendingDown, DollarSign, Percent, BarChart3, Landmark, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import ExportButton from "@/components/gestor/ExportButton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { startOfDay, endOfDay, subMonths, startOfMonth, startOfYear, format } from "date-fns";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

type FinQuick = "ciclo" | "3m" | "6m" | "ano" | "custom";

const FIN_QUICK_LABELS: Record<FinQuick, string> = {
  ciclo: "Toda a campanha",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  ano: "Este ano",
  custom: "Personalizado",
};

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

  // Period filter
  const [finQuick, setFinQuick] = useState<FinQuick>("ciclo");
  const [finFrom, setFinFrom] = useState<Date>(new Date(0));
  const [finTo, setFinTo] = useState<Date>(endOfDay(new Date()));
  const [finFromStr, setFinFromStr] = useState("");
  const [finToStr, setFinToStr] = useState("");

  const selectFinQuick = (q: FinQuick) => {
    setFinQuick(q);
    const today = new Date();
    let f: Date, t: Date;
    switch (q) {
      case "ciclo": f = new Date(0); t = endOfDay(today); break;
      case "3m": f = startOfDay(subMonths(today, 3)); t = endOfDay(today); break;
      case "6m": f = startOfDay(subMonths(today, 6)); t = endOfDay(today); break;
      case "ano": f = startOfYear(today); t = endOfDay(today); break;
      default: return;
    }
    setFinFrom(f); setFinTo(t);
    if (q !== "ciclo") { setFinFromStr(format(f, "yyyy-MM-dd")); setFinToStr(format(t, "yyyy-MM-dd")); }
  };

  const applyFinCustom = () => {
    if (finFromStr && finToStr) {
      setFinQuick("custom");
      setFinFrom(startOfDay(new Date(finFromStr + "T00:00:00")));
      setFinTo(endOfDay(new Date(finToStr + "T00:00:00")));
    }
  };

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

      let pedQ = supabase.from("pedidos").select("valor_total, data_pedido, campanha_id, consumidor_id");
      if (selectedCampanha !== "todas") pedQ = pedQ.eq("campanha_id", selectedCampanha);
      const [{ data: p }, { data: pz }, { data: validConsumers }] = await Promise.all([
        pedQ,
        supabase.from("pizzarias").select("id, nome, matricula_paga"),
        supabase.from("usuarios").select("id").not("nome", "is", null).neq("nome", "").not("telefone", "is", null).neq("telefone", ""),
      ]);
      let coQ = supabase.from("custos_operacionais").select("*");
      if (selectedCampanha !== "todas") coQ = coQ.eq("campanha_id", selectedCampanha);
      const { data: co } = await coQ;
      let clQ = supabase.from("custos").select("*");
      if (selectedCampanha !== "todas") clQ = clQ.eq("campanha_id", selectedCampanha);
      const { data: cl } = await clQ;
      const validIds = new Set((validConsumers ?? []).map((u: any) => u.id));
      setPedidos((p ?? []).filter((ped: any) => validIds.has(ped.consumidor_id)));
      setPizzarias(pz ?? []);
      setCustosOp(co ?? []);
      setCustosLeg(cl ?? []);
      setLoading(false);
    };
    fetch();
  }, [selectedCampanha]);

  const pctDecimal = comissao / 100;

  const filteredPedidos = useMemo(() => {
    if (finQuick === "ciclo") return pedidos;
    return pedidos.filter(p => {
      const d = new Date(p.data_pedido);
      return d >= finFrom && d <= finTo;
    });
  }, [pedidos, finQuick, finFrom, finTo]);

  const stats = useMemo(() => {
    const totalVendas = filteredPedidos.reduce((s, p) => s + Number(p.valor_total), 0);
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
  }, [filteredPedidos, pizzarias, custosOp, custosLeg, pctDecimal, valorAdesao]);

  const chartData = useMemo(() => {
    const byMonth: Record<string, { vendas: number }> = {};
    filteredPedidos.forEach(p => {
      const m = new Date(p.data_pedido).toISOString().slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { vendas: 0 };
      byMonth[m].vendas += Number(p.valor_total);
    });
    const totalCustosMes = stats.totalCustos / Math.max(Object.keys(byMonth).length, 1);
    return Object.entries(byMonth).sort().map(([mes, d]) => {
      const recPP = d.vendas * pctDecimal;
      return { mes: mes.split("-").reverse().join("/"), receita: recPP, custos: totalCustosMes, lucro: recPP - totalCustosMes };
    });
  }, [filteredPedidos, stats.totalCustos, pctDecimal]);

  const tableData = useMemo(() => {
    const byMonth: Record<string, number> = {};
    filteredPedidos.forEach(p => {
      const m = new Date(p.data_pedido).toISOString().slice(0, 7);
      byMonth[m] = (byMonth[m] || 0) + Number(p.valor_total);
    });
    const months = Object.keys(byMonth).sort();
    const custoMes = stats.totalCustos / Math.max(months.length, 1);
    return months.map((m: string) => {
      const v = byMonth[m];
      const pp = v * pctDecimal;
      const pz = v * (1 - pctDecimal);
      const lucro = pp - custoMes;
      return { mes: m.split("-").reverse().join("/"), fatTotal: v, fatPP: pp, fatPizzarias: pz, custos: custoMes, lucro, margem: pp > 0 ? (lucro / pp) * 100 : 0 };
    });
  }, [filteredPedidos, stats.totalCustos, pctDecimal]);

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;

  const finPeriodLabel = finQuick === "ciclo" ? FIN_QUICK_LABELS.ciclo : finQuick === "custom"
    ? `${format(finFrom, "dd/MM/yyyy")} – ${format(finTo, "dd/MM/yyyy")}`
    : FIN_QUICK_LABELS[finQuick];

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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-heading text-2xl font-bold">Visão Geral</h1>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {finPeriodLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 space-y-3" align="end">
              <p className="text-xs font-medium text-muted-foreground">Período</p>
              <div className="flex flex-wrap gap-1.5">
                {(["ciclo", "3m", "6m", "ano"] as FinQuick[]).map((q) => (
                  <Button key={q} variant={finQuick === q ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => selectFinQuick(q)}>
                    {FIN_QUICK_LABELS[q]}
                  </Button>
                ))}
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Personalizado</p>
                <div className="flex items-center gap-1">
                  <Input type="date" className="h-7 text-xs" value={finFromStr} onChange={(e) => setFinFromStr(e.target.value)} />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input type="date" className="h-7 text-xs" value={finToStr} onChange={(e) => setFinToStr(e.target.value)} />
                </div>
                <Button size="sm" className="text-xs h-7 w-full" onClick={applyFinCustom} disabled={!finFromStr || !finToStr}>Aplicar</Button>
              </div>
            </PopoverContent>
          </Popover>
          <ExportButton
          data={tableData.map(r => ({ ...r, fatTotal: fmt(r.fatTotal), fatPP: fmt(r.fatPP), fatPizzarias: fmt(r.fatPizzarias), custos: fmt(r.custos), lucro: fmt(r.lucro), margem: fmtPct(r.margem) }))}
          columns={[
            { key: "mes", label: "Mês" }, { key: "fatTotal", label: "Faturamento Total" },
            { key: "fatPP", label: `Fat. PP (${comissao}%)` }, { key: "fatPizzarias", label: `Fat. Pizzarias (${100 - comissao}%)` },
            { key: "custos", label: "Custos" }, { key: "lucro", label: "Lucro" }, { key: "margem", label: "Margem %" },
          ]}
          fileName="financeiro-visao-geral"
        />
        </div>
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
                <TableHead className="text-right">Fat. PP ({comissao}%)</TableHead><TableHead className="text-right">Fat. Pizzarias ({100 - comissao}%)</TableHead>
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
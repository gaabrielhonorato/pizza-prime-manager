import { useMemo, useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Receipt, Store, DollarSign, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import ExportButton from "@/components/gestor/ExportButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

interface ContextType { selectedCampanha: string; periodo: string; }

export default function FinanceiroReceitas() {
  const { selectedCampanha } = useOutletContext<ContextType>();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pizzarias, setPizzarias] = useState<any[]>([]);
  const [selectedPizzaria, setSelectedPizzaria] = useState("todas");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      let pQ = supabase.from("pedidos").select("valor_total, data_pedido, pizzaria_id, campanha_id");
      if (selectedCampanha !== "todas") pQ = pQ.eq("campanha_id", selectedCampanha);
      const { data: p } = await pQ;
      const { data: pz } = await supabase.from("pizzarias").select("id, nome, cidade, matricula_paga, data_entrada");
      setPedidos(p ?? []);
      setPizzarias(pz ?? []);
      setLoading(false);
    };
    fetch();
  }, [selectedCampanha]);

  const filtered = useMemo(() => {
    if (selectedPizzaria === "todas") return pedidos;
    return pedidos.filter(p => p.pizzaria_id === selectedPizzaria);
  }, [pedidos, selectedPizzaria]);

  const stats = useMemo(() => {
    const totalVendas = filtered.reduce((s, p) => s + Number(p.valor_total), 0);
    const matriculas = pizzarias.filter(p => p.matricula_paga).length;
    const totalMatriculas = matriculas * 799;
    const totalComissoes = totalVendas * 0.15;
    const totalCiclo = totalMatriculas + totalComissoes;
    const receitaMedia = pizzarias.length > 0 ? totalCiclo / pizzarias.length : 0;
    return { totalVendas, matriculas, totalMatriculas, totalComissoes, totalCiclo, receitaMedia };
  }, [filtered, pizzarias]);

  const porPizzaria = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(p => { map[p.pizzaria_id] = (map[p.pizzaria_id] || 0) + Number(p.valor_total); });
    return pizzarias.map(pz => {
      const vendido = map[pz.id] || 0;
      const comissao = vendido * 0.15;
      const matricula = pz.matricula_paga ? 799 : 0;
      const totalPP = comissao + matricula;
      return { id: pz.id, nome: pz.nome, cidade: pz.cidade, entrada: pz.data_entrada, vendido, comissao, matricula, totalPP, pctTotal: stats.totalCiclo > 0 ? (totalPP / stats.totalCiclo) * 100 : 0 };
    }).sort((a, b) => b.totalPP - a.totalPP);
  }, [filtered, pizzarias, stats.totalCiclo]);

  const chartData = porPizzaria.slice(0, 15).map(p => ({ nome: p.nome.length > 12 ? p.nome.slice(0, 12) + "…" : p.nome, receita: p.comissao }));

  const mensal = useMemo(() => {
    const byMonth: Record<string, { vendas: number; pizzarias: Set<string> }> = {};
    filtered.forEach(p => {
      const m = new Date(p.data_pedido).toISOString().slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { vendas: 0, pizzarias: new Set() };
      byMonth[m].vendas += Number(p.valor_total);
      byMonth[m].pizzarias.add(p.pizzaria_id);
    });
    return Object.entries(byMonth).sort().map(([mes, d]) => ({
      mes: mes.split("-").reverse().join("/"),
      pizzariasAtivas: d.pizzarias.size,
      totalVendido: d.vendas,
      comissoes: d.vendas * 0.15,
      matriculas: 0,
      totalPP: d.vendas * 0.15,
    }));
  }, [filtered]);

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Receitas</h1>
        <div className="flex items-center gap-3">
          <Select value={selectedPizzaria} onValueChange={setSelectedPizzaria}>
            <SelectTrigger className="w-[200px] h-8 text-sm"><SelectValue placeholder="Pizzaria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as pizzarias</SelectItem>
              {pizzarias.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <ExportButton
            data={porPizzaria.map(r => ({ ...r, vendido: fmt(r.vendido), comissao: fmt(r.comissao), matricula: fmt(r.matricula), totalPP: fmt(r.totalPP), pctTotal: fmtPct(r.pctTotal) }))}
            columns={[
              { key: "nome", label: "Pizzaria" }, { key: "cidade", label: "Cidade" },
              { key: "vendido", label: "Total Vendido" }, { key: "comissao", label: "Comissão PP (15%)" },
              { key: "matricula", label: "Matrícula" }, { key: "totalPP", label: "Total PP" }, { key: "pctTotal", label: "% do Total" },
            ]}
            fileName="financeiro-receitas"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><Receipt className="h-5 w-5 text-primary" /><CardTitle className="text-sm text-muted-foreground">Total Matrículas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold">{stats.matriculas} × R$ 799 = {fmt(stats.totalMatriculas)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><DollarSign className="h-5 w-5 text-success" /><CardTitle className="text-sm text-muted-foreground">Total Comissões (15%)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold text-success">{fmt(stats.totalComissoes)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><TrendingUp className="h-5 w-5 text-primary" /><CardTitle className="text-sm text-muted-foreground">Total do Ciclo</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold text-primary">{fmt(stats.totalCiclo)}</p></CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center gap-2 pb-2"><Store className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-sm text-muted-foreground">Receita Média / Pizzaria</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-heading font-bold">{fmt(stats.receitaMedia)}</p></CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="font-heading">Receita por Pizzaria</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nome" width={80} className="text-xs" />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="receita" name="Comissão PP" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="font-heading">Detalhamento por Pizzaria</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pizzaria</TableHead><TableHead>Cidade</TableHead>
                <TableHead className="text-right">Total Vendido</TableHead><TableHead className="text-right">Comissão PP (15%)</TableHead>
                <TableHead className="text-right">Matrícula</TableHead><TableHead className="text-right">Total PP</TableHead>
                <TableHead className="text-right">% do Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porPizzaria.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell>{r.cidade}</TableCell>
                  <TableCell className="text-right">{fmt(r.vendido)}</TableCell>
                  <TableCell className="text-right">{fmt(r.comissao)}</TableCell>
                  <TableCell className="text-right">{fmt(r.matricula)}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(r.totalPP)}</TableCell>
                  <TableCell className="text-right">{fmtPct(r.pctTotal)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-bold">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right">{fmt(stats.totalVendas)}</TableCell>
                <TableCell className="text-right">{fmt(stats.totalComissoes)}</TableCell>
                <TableCell className="text-right">{fmt(stats.totalMatriculas)}</TableCell>
                <TableCell className="text-right">{fmt(stats.totalCiclo)}</TableCell>
                <TableCell className="text-right">100%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="font-heading">Receita Mensal</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead><TableHead className="text-right">Pizzarias Ativas</TableHead>
                <TableHead className="text-right">Total Vendido</TableHead><TableHead className="text-right">Comissões</TableHead>
                <TableHead className="text-right">Total PP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mensal.map(r => (
                <TableRow key={r.mes}>
                  <TableCell>{r.mes}</TableCell>
                  <TableCell className="text-right">{r.pizzariasAtivas}</TableCell>
                  <TableCell className="text-right">{fmt(r.totalVendido)}</TableCell>
                  <TableCell className="text-right">{fmt(r.comissoes)}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(r.totalPP)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
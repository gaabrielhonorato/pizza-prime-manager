import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import ExportButton from "@/components/gestor/ExportButton";
import { format, addDays, subDays, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

interface ContextType { selectedCampanha: string; periodo: string; }

export default function FinanceiroDiario() {
  const { selectedCampanha } = useOutletContext<ContextType>();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pizzarias, setPizzarias] = useState<any[]>([]);
  const [campanha, setCampanha] = useState<any>(null);
  const [filterPizzaria, setFilterPizzaria] = useState("todas");
  const [loading, setLoading] = useState(true);

  const dateObj = new Date(date + "T12:00:00");
  const dateLabel = isToday(dateObj) ? "Hoje" : isYesterday(dateObj) ? "Ontem" : format(dateObj, "dd/MM/yyyy");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      // Get campaign with rates
      let campId = selectedCampanha;
      if (campId === "todas") {
        const { data: cp } = await supabase.from("campanhas").select("*").eq("is_principal", true).limit(1).single();
        campId = cp?.id ?? "";
        setCampanha(cp);
      } else {
        const { data: cp } = await supabase.from("campanhas").select("*").eq("id", campId).single();
        setCampanha(cp);
      }

      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59`;
      let q = supabase.from("pedidos").select("*").gte("data_pedido", dayStart).lte("data_pedido", dayEnd);
      if (selectedCampanha !== "todas") q = q.eq("campanha_id", selectedCampanha);
      const [{ data: p }, { data: pz }, { data: validConsumers }] = await Promise.all([
        q,
        supabase.from("pizzarias").select("id, nome"),
        supabase.from("consumidores").select("id, usuarios(nome, telefone)"),
      ]);
      const validIds = new Set((validConsumers ?? []).filter((c: any) => c.usuarios?.nome && c.usuarios?.telefone).map((c: any) => c.id));
      setPedidos((p ?? []).filter((ped: any) => validIds.has(ped.consumidor_id)));
      setPizzarias(pz ?? []);
      setLoading(false);
    };
    fetch();
  }, [date, selectedCampanha]);

  const taxaDel = campanha?.taxa_delivery ?? 15;
  const taxaRet = campanha?.taxa_retirada ?? 15;
  const taxaLoc = campanha?.taxa_local ?? 12;

  const getTaxa = (tipo: string | null) => {
    if (tipo === "retirada") return taxaRet;
    if (tipo === "local") return taxaLoc;
    return taxaDel;
  };

  const tableData = useMemo(() => {
    const filtered = filterPizzaria === "todas" ? pedidos : pedidos.filter(p => p.pizzaria_id === filterPizzaria);
    const byPz: Record<string, { delivery: any[]; retirada: any[]; local: any[] }> = {};
    filtered.forEach(p => {
      if (!byPz[p.pizzaria_id]) byPz[p.pizzaria_id] = { delivery: [], retirada: [], local: [] };
      const tipo = p.tipo_pedido === "retirada" ? "retirada" : p.tipo_pedido === "local" ? "local" : "delivery";
      byPz[p.pizzaria_id][tipo].push(p);
    });
    return Object.entries(byPz).map(([pzId, types]) => {
      const delTotal = types.delivery.reduce((s, p) => s + Number(p.valor_total), 0);
      const retTotal = types.retirada.reduce((s, p) => s + Number(p.valor_total), 0);
      const locTotal = types.local.reduce((s, p) => s + Number(p.valor_total), 0);
      const delPP = delTotal * taxaDel / 100;
      const retPP = retTotal * taxaRet / 100;
      const locPP = locTotal * taxaLoc / 100;
      const totalDia = delTotal + retTotal + locTotal;
      const totalPP = delPP + retPP + locPP;
      const autoSplit = types.delivery.filter(p => p.canal === "cardapioweb").reduce((s, p) => s + Number(p.valor_total), 0) * taxaDel / 100
        + types.retirada.filter(p => p.canal === "cardapioweb").reduce((s, p) => s + Number(p.valor_total), 0) * taxaRet / 100
        + types.local.filter(p => p.canal === "cardapioweb").reduce((s, p) => s + Number(p.valor_total), 0) * taxaLoc / 100;
      return {
        pizzariaId: pzId,
        nome: pizzarias.find(z => z.id === pzId)?.nome ?? "—",
        delQtd: types.delivery.length, delTotal, delTaxa: taxaDel, delPP,
        retQtd: types.retirada.length, retTotal, retTaxa: taxaRet, retPP,
        locQtd: types.local.length, locTotal, locTaxa: taxaLoc, locPP,
        totalDia, totalPP, autoSplit, pendManual: totalPP - autoSplit,
      };
    });
  }, [pedidos, pizzarias, filterPizzaria, taxaDel, taxaRet, taxaLoc]);

  const totals = useMemo(() => tableData.reduce((acc, r) => ({
    totalVendido: acc.totalVendido + r.totalDia,
    totalPP: acc.totalPP + r.totalPP,
    totalPizzarias: acc.totalPizzarias + (r.totalDia - r.totalPP),
    autoSplit: acc.autoSplit + r.autoSplit,
    pendManual: acc.pendManual + r.pendManual,
    pedidos: acc.pedidos + r.delQtd + r.retQtd + r.locQtd,
  }), { totalVendido: 0, totalPP: 0, totalPizzarias: 0, autoSplit: 0, pendManual: 0, pedidos: 0 }), [tableData]);

  const autoCount = pedidos.filter(p => p.canal === "cardapioweb").length;
  const manualCount = pedidos.length - autoCount;

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;

  const exportData = tableData.map(r => ({
    pizzaria: r.nome,
    del_qtd: r.delQtd, del_vendido: fmt(r.delTotal), del_taxa: `${r.delTaxa}%`, del_pp: fmt(r.delPP),
    ret_qtd: r.retQtd, ret_vendido: fmt(r.retTotal), ret_taxa: `${r.retTaxa}%`, ret_pp: fmt(r.retPP),
    loc_qtd: r.locQtd, loc_vendido: fmt(r.locTotal), loc_taxa: `${r.locTaxa}%`, loc_pp: fmt(r.locPP),
    total: fmt(r.totalDia), auto_split: fmt(r.autoSplit), pend_manual: fmt(r.pendManual),
  }));
  const exportCols = [
    { key: "pizzaria", label: "Pizzaria" },
    { key: "del_qtd", label: "Del. Qtd" }, { key: "del_vendido", label: "Del. Vendido" }, { key: "del_taxa", label: "Del. Taxa" }, { key: "del_pp", label: "Del. PP" },
    { key: "ret_qtd", label: "Ret. Qtd" }, { key: "ret_vendido", label: "Ret. Vendido" }, { key: "ret_taxa", label: "Ret. Taxa" }, { key: "ret_pp", label: "Ret. PP" },
    { key: "loc_qtd", label: "Salão Qtd" }, { key: "loc_vendido", label: "Salão Vendido" }, { key: "loc_taxa", label: "Salão Taxa" }, { key: "loc_pp", label: "Salão PP" },
    { key: "total", label: "Total Dia" }, { key: "auto_split", label: "Split Auto" }, { key: "pend_manual", label: "Pendente Manual" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Relatório Diário</h1>
        <ExportButton data={exportData} columns={exportCols} fileName={`diario-${date}`} />
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setDate(subDays(dateObj, 1).toISOString().slice(0, 10))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-[160px] h-8 text-sm" />
          <span className="text-sm font-medium text-muted-foreground">{dateLabel}</span>
        </div>
        <Button variant="outline" size="icon" onClick={() => setDate(addDays(dateObj, 1).toISOString().slice(0, 10))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Select value={filterPizzaria} onValueChange={setFilterPizzaria}>
          <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas pizzarias</SelectItem>
            {pizzarias.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-border bg-card"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total vendido</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold">{fmt(totals.totalVendido)}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total PP</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold text-primary">{fmt(totals.totalPP)}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total pizzarias</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold">{fmt(totals.totalPizzarias)}</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Automáticos</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold">{autoCount} pedidos</p></CardContent></Card>
        <Card className="border-border bg-card"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Manuais</CardTitle></CardHeader><CardContent><p className="text-2xl font-heading font-bold">{manualCount} pedidos</p></CardContent></Card>
      </div>

      {/* Detail table */}
      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="font-heading">Detalhamento por Pizzaria</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {tableData.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Nenhum pedido neste dia.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2} className="align-bottom">Pizzaria</TableHead>
                  <TableHead colSpan={4} className="text-center border-l border-border">Delivery</TableHead>
                  <TableHead colSpan={4} className="text-center border-l border-border">Retirada</TableHead>
                  <TableHead colSpan={4} className="text-center border-l border-border">Salão</TableHead>
                  <TableHead className="text-right border-l border-border">Total</TableHead>
                  <TableHead className="text-right">Split Auto</TableHead>
                  <TableHead className="text-right">Pend. Manual</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="text-right border-l border-border text-xs">Qtd</TableHead>
                  <TableHead className="text-right text-xs">Vendido</TableHead>
                  <TableHead className="text-right text-xs">Taxa</TableHead>
                  <TableHead className="text-right text-xs">PP</TableHead>
                  <TableHead className="text-right border-l border-border text-xs">Qtd</TableHead>
                  <TableHead className="text-right text-xs">Vendido</TableHead>
                  <TableHead className="text-right text-xs">Taxa</TableHead>
                  <TableHead className="text-right text-xs">PP</TableHead>
                  <TableHead className="text-right border-l border-border text-xs">Qtd</TableHead>
                  <TableHead className="text-right text-xs">Vendido</TableHead>
                  <TableHead className="text-right text-xs">Taxa</TableHead>
                  <TableHead className="text-right text-xs">PP</TableHead>
                  <TableHead className="border-l border-border" />
                  <TableHead />
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map(r => (
                  <TableRow key={r.pizzariaId}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right border-l border-border">{r.delQtd}</TableCell>
                    <TableCell className="text-right">{fmt(r.delTotal)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.delTaxa}%</TableCell>
                    <TableCell className="text-right">{fmt(r.delPP)}</TableCell>
                    <TableCell className="text-right border-l border-border">{r.retQtd}</TableCell>
                    <TableCell className="text-right">{fmt(r.retTotal)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.retTaxa}%</TableCell>
                    <TableCell className="text-right">{fmt(r.retPP)}</TableCell>
                    <TableCell className="text-right border-l border-border">{r.locQtd}</TableCell>
                    <TableCell className="text-right">{fmt(r.locTotal)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.locTaxa}%</TableCell>
                    <TableCell className="text-right">{fmt(r.locPP)}</TableCell>
                    <TableCell className="text-right font-medium border-l border-border">{fmt(r.totalDia)}</TableCell>
                    <TableCell className="text-right">{fmt(r.autoSplit)}</TableCell>
                    <TableCell className="text-right font-medium text-amber-500">{fmt(r.pendManual)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right border-l border-border">{tableData.reduce((s, r) => s + r.delQtd, 0)}</TableCell>
                  <TableCell className="text-right">{fmt(tableData.reduce((s, r) => s + r.delTotal, 0))}</TableCell>
                  <TableCell />
                  <TableCell className="text-right">{fmt(tableData.reduce((s, r) => s + r.delPP, 0))}</TableCell>
                  <TableCell className="text-right border-l border-border">{tableData.reduce((s, r) => s + r.retQtd, 0)}</TableCell>
                  <TableCell className="text-right">{fmt(tableData.reduce((s, r) => s + r.retTotal, 0))}</TableCell>
                  <TableCell />
                  <TableCell className="text-right">{fmt(tableData.reduce((s, r) => s + r.retPP, 0))}</TableCell>
                  <TableCell className="text-right border-l border-border">{tableData.reduce((s, r) => s + r.locQtd, 0)}</TableCell>
                  <TableCell className="text-right">{fmt(tableData.reduce((s, r) => s + r.locTotal, 0))}</TableCell>
                  <TableCell />
                  <TableCell className="text-right">{fmt(tableData.reduce((s, r) => s + r.locPP, 0))}</TableCell>
                  <TableCell className="text-right border-l border-border">{fmt(totals.totalVendido)}</TableCell>
                  <TableCell className="text-right">{fmt(totals.autoSplit)}</TableCell>
                  <TableCell className="text-right text-amber-500">{fmt(totals.pendManual)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
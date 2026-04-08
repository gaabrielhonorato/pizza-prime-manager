import { useState, useEffect, useMemo } from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, Download, CalendarIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  pizzariaId: string;
  pizzariaNome: string;
}

interface PedidoRow {
  id: string;
  data_pedido: string;
  valor_total: number;
  canal: string;
  cupons_gerados: number;
  status: string;
  forma_pagamento: string | null;
  cliente: string;
}

type QuickPeriod = "hoje" | "7dias" | "30dias" | "este_mes" | "mes_anterior" | "todo";

const PERIOD_LABELS: Record<QuickPeriod, string> = {
  hoje: "Hoje", "7dias": "7 dias", "30dias": "30 dias",
  este_mes: "Este mês", mes_anterior: "Mês anterior", todo: "Todo o ciclo",
};

const FORMAS = ["Cartão crédito", "Cartão débito", "Pix", "Dinheiro", "Voucher", "Outros"];
const CANAIS = ["CardápioWeb", "Balcão", "WhatsApp"];
const STATUSES = ["Entregue", "Cancelado", "Em preparo", "recebido", "entregue", "cancelado"];
const PIE_COLORS = ["hsl(25 95% 53%)", "hsl(200 80% 50%)", "hsl(140 70% 45%)", "hsl(50 90% 50%)", "hsl(280 60% 55%)", "hsl(0 60% 50%)"];

function getRange(p: QuickPeriod): [Date, Date] | null {
  const t = startOfDay(new Date());
  switch (p) {
    case "hoje": return [t, endOfDay(t)];
    case "7dias": return [subDays(t, 6), endOfDay(t)];
    case "30dias": return [subDays(t, 29), endOfDay(t)];
    case "este_mes": return [startOfMonth(t), endOfDay(t)];
    case "mes_anterior": { const prev = subMonths(t, 1); return [startOfMonth(prev), endOfDay(endOfMonth(prev))]; }
    case "todo": return null;
  }
}

export default function PizzariaMetricsModal({ open, onClose, pizzariaId, pizzariaNome }: Props) {
  const [allPedidos, setAllPedidos] = useState<PedidoRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>("30dias");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [formaFilter, setFormaFilter] = useState<string[]>([]);
  const [canalFilter, setCanalFilter] = useState<string[]>([]);
  const [statusFilterArr, setStatusFilterArr] = useState<string[]>([]);
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");

  useEffect(() => {
    if (!open || !pizzariaId) return;
    setLoading(true);
    const fetch = async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id, data_pedido, valor_total, canal, cupons_gerados, status, forma_pagamento, consumidor_id, consumidores(usuario_id, usuarios:usuario_id(nome))")
        .eq("pizzaria_id", pizzariaId)
        .order("data_pedido", { ascending: false });

      setAllPedidos((data ?? []).map((p: any) => ({
        id: p.id,
        data_pedido: p.data_pedido,
        valor_total: Number(p.valor_total),
        canal: p.canal ?? "—",
        cupons_gerados: p.cupons_gerados,
        status: p.status,
        forma_pagamento: p.forma_pagamento,
        cliente: p.consumidores?.usuarios?.nome ?? "Cliente avulso",
      })));
      setLoading(false);
    };
    fetch();
  }, [open, pizzariaId]);

  const filtered = useMemo(() => {
    let list = [...allPedidos];

    // Period
    if (customFrom || customTo) {
      if (customFrom) list = list.filter(p => new Date(p.data_pedido) >= customFrom);
      if (customTo) { const end = endOfDay(customTo); list = list.filter(p => new Date(p.data_pedido) <= end); }
    } else {
      const range = getRange(quickPeriod);
      if (range) {
        const [from, to] = range;
        list = list.filter(p => { const d = new Date(p.data_pedido); return d >= from && d <= to; });
      }
    }

    if (formaFilter.length > 0) list = list.filter(p => p.forma_pagamento && formaFilter.includes(p.forma_pagamento));
    if (canalFilter.length > 0) list = list.filter(p => canalFilter.includes(p.canal));
    if (statusFilterArr.length > 0) list = list.filter(p => statusFilterArr.includes(p.status));
    const minV = valorMin ? Number(valorMin) : null;
    const maxV = valorMax ? Number(valorMax) : null;
    if (minV !== null && !isNaN(minV)) list = list.filter(p => p.valor_total >= minV);
    if (maxV !== null && !isNaN(maxV)) list = list.filter(p => p.valor_total <= maxV);
    return list;
  }, [allPedidos, quickPeriod, customFrom, customTo, formaFilter, canalFilter, statusFilterArr, valorMin, valorMax]);

  const totalVendido = filtered.reduce((s, p) => s + p.valor_total, 0);
  const totalCupons = filtered.reduce((s, p) => s + p.cupons_gerados, 0);
  const ticketMedio = filtered.length > 0 ? totalVendido / filtered.length : 0;
  const repasse = totalVendido * 0.85;

  const clearFilters = () => {
    setQuickPeriod("30dias");
    setCustomFrom(undefined);
    setCustomTo(undefined);
    setFormaFilter([]);
    setCanalFilter([]);
    setStatusFilterArr([]);
    setValorMin("");
    setValorMax("");
  };

  // Chart data for Visão Geral
  const chartData = useMemo(() => {
    if (filtered.length === 0) return [];
    const dates = filtered.map(p => new Date(p.data_pedido));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const days = eachDayOfInterval({ start: startOfDay(minDate), end: startOfDay(maxDate) });
    return days.map(d => ({
      label: format(d, "dd/MM"),
      pedidos: filtered.filter(p => isSameDay(new Date(p.data_pedido), d)).length,
    }));
  }, [filtered]);

  // Payment method data
  const paymentData = useMemo(() => {
    const map = new Map<string, { qty: number; total: number }>();
    filtered.forEach(p => {
      const key = p.forma_pagamento || "Não informado";
      const curr = map.get(key) ?? { qty: 0, total: 0 };
      curr.qty++;
      curr.total += p.valor_total;
      map.set(key, curr);
    });
    return [...map.entries()].map(([name, { qty, total }]) => ({
      name, qty, total, pct: filtered.length > 0 ? (qty / filtered.length * 100) : 0,
      ticket: qty > 0 ? total / qty : 0,
    })).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const toggleArr = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  const exportCSV = () => {
    const headers = ["Data/Hora", "ID", "Cliente", "Valor", "Forma Pgto", "Canal", "Status", "Cupons"];
    const rows = filtered.map(p => [
      format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm"),
      p.id.slice(0, 8), p.cliente, `R$ ${p.valor_total}`,
      p.forma_pagamento ?? "—", p.canal, p.status, String(p.cupons_gerados),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `metricas_${pizzariaNome.replace(/\s/g, "_")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const DatePick = ({ label, value, onChange }: { label: string; value?: Date; onChange: (d: Date | undefined) => void }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 text-xs w-[130px] justify-start", !value && "text-muted-foreground")}>
          <CalendarIcon className="mr-1 h-3 w-3" />
          {value ? format(value, "dd/MM/yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[60]" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} className="p-3 pointer-events-auto" locale={ptBR} />
      </PopoverContent>
    </Popover>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[90vw] h-[90vh] p-0 gap-0 flex flex-col overflow-hidden [&>button]:hidden" style={{ backdropFilter: "blur(8px)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-xl font-bold font-heading">{pizzariaNome}</h2>
            <p className="text-sm text-muted-foreground">
              Exibindo {filtered.length} pedidos · {fmtMoney(totalVendido)} em vendas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-1 h-4 w-4" />Exportar CSV</Button>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-border bg-muted/30 shrink-0 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PERIOD_LABELS) as QuickPeriod[]).map(p => (
              <Button key={p} size="sm" variant={quickPeriod === p && !customFrom && !customTo ? "default" : "outline"} className="h-7 text-xs"
                onClick={() => { setQuickPeriod(p); setCustomFrom(undefined); setCustomTo(undefined); }}>
                {PERIOD_LABELS[p]}
              </Button>
            ))}
            <DatePick label="De" value={customFrom} onChange={setCustomFrom} />
            <DatePick label="Até" value={customTo} onChange={setCustomTo} />
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Forma de pagamento</Label>
              <div className="flex flex-wrap gap-2">
                {FORMAS.map(f => (
                  <label key={f} className="flex items-center gap-1 text-xs">
                    <Checkbox checked={formaFilter.includes(f)} onCheckedChange={() => setFormaFilter(toggleArr(formaFilter, f))} />
                    {f}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Canal</Label>
              <div className="flex gap-2">
                {CANAIS.map(c => (
                  <label key={c} className="flex items-center gap-1 text-xs">
                    <Checkbox checked={canalFilter.includes(c)} onCheckedChange={() => setCanalFilter(toggleArr(canalFilter, c))} />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Faixa de valor (R$)</Label>
              <div className="flex gap-1">
                <Input className="h-7 w-20 text-xs" placeholder="Mín" value={valorMin} onChange={e => setValorMin(e.target.value)} />
                <Input className="h-7 w-20 text-xs" placeholder="Máx" value={valorMax} onChange={e => setValorMax(e.target.value)} />
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={clearFilters}>Limpar filtros</Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>
          ) : (
            <Tabs defaultValue="visao" className="space-y-4">
              <TabsList>
                <TabsTrigger value="visao">Visão Geral</TabsTrigger>
                <TabsTrigger value="pagamentos">Formas de Pagamento</TabsTrigger>
                <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
              </TabsList>

              <TabsContent value="visao" className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    { label: "Total de pedidos", value: String(filtered.length) },
                    { label: "Total vendido", value: fmtMoney(totalVendido) },
                    { label: "Ticket médio", value: fmtMoney(ticketMedio) },
                    { label: "Cupons gerados", value: String(totalCupons) },
                    { label: "Repasse (85%)", value: fmtMoney(repasse) },
                  ].map(k => (
                    <Card key={k.label} className="border-border">
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xs text-muted-foreground">{k.label}</p>
                        <p className="text-xl font-bold mt-1">{k.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {chartData.length > 0 && (
                  <Card className="border-border">
                    <CardContent className="pt-4">
                      <ChartContainer config={{ pedidos: { label: "Pedidos", color: "hsl(25 95% 53%)" } }} className="h-[280px] w-full">
                        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} interval="preserveStartEnd" />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line type="monotone" dataKey="pedidos" stroke="hsl(25 95% 53%)" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="pagamentos" className="space-y-4">
                <div className="grid lg:grid-cols-2 gap-6">
                  <Card className="border-border">
                    <CardContent className="pt-4 flex items-center justify-center" style={{ height: 320 }}>
                      {paymentData.length === 0 ? (
                        <p className="text-muted-foreground">Sem dados</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie data={paymentData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, pct }) => `${name} (${pct.toFixed(0)}%)`}>
                              {paymentData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <ChartTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border-border">
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Forma</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">%</TableHead>
                            <TableHead className="text-right">Ticket</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paymentData.map(p => (
                            <TableRow key={p.name}>
                              <TableCell className="font-medium text-sm">{p.name}</TableCell>
                              <TableCell className="text-right text-sm">{p.qty}</TableCell>
                              <TableCell className="text-right text-sm">{fmtMoney(p.total)}</TableCell>
                              <TableCell className="text-right text-sm">{p.pct.toFixed(1)}%</TableCell>
                              <TableCell className="text-right text-sm">{fmtMoney(p.ticket)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="pedidos" className="space-y-4">
                <Card className="border-border">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Nº Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Forma Pgto</TableHead>
                          <TableHead>Canal</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Cupons</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum pedido encontrado.</TableCell></TableRow>
                        ) : filtered.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs">{format(new Date(p.data_pedido), "dd/MM/yy HH:mm")}</TableCell>
                            <TableCell className="text-xs font-mono">{p.id.slice(0, 8)}</TableCell>
                            <TableCell className="text-sm">{p.cliente}</TableCell>
                            <TableCell className="text-right text-sm">{fmtMoney(p.valor_total)}</TableCell>
                            <TableCell className="text-xs">{p.forma_pagamento ?? "—"}</TableCell>
                            <TableCell className="text-xs">{p.canal}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={p.status === "cancelado" ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}>
                                {p.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-primary">{p.cupons_gerados}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filtered.length > 0 && (
                      <div className="border-t border-border px-4 py-3 flex flex-wrap gap-6 text-sm">
                        <span><span className="text-muted-foreground">Pedidos:</span> <strong>{filtered.length}</strong></span>
                        <span><span className="text-muted-foreground">Total:</span> <strong>{fmtMoney(totalVendido)}</strong></span>
                        <span><span className="text-muted-foreground">Média:</span> <strong>{fmtMoney(ticketMedio)}</strong></span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

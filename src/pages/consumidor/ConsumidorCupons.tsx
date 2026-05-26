import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket, Trophy, CalendarDays } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useConsumidorData } from "@/contexts/ConsumidorDataContext";
import { supabase } from "@/integrations/supabase/client";
import { rangeToLucky } from "@/lib/lucky-numbers";
import { format, startOfMonth, endOfMonth, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const chartConfig = { cupons: { label: "Cupons", color: "hsl(25 95% 53%)" } };

export default function ConsumidorCupons() {
  const { totalCupons, posicaoRanking, cupons, consumidorId, campanhaId, loading } = useConsumidorData();
  const [periodo, setPeriodo] = useState("mes");
  const [page, setPage] = useState(0);
  const perPage = 10;

  const [meusNumeros, setMeusNumeros] = useState<{ start: number; end: number }[]>([]);
  const [numerosLoading, setNumerosLoading] = useState(false);

  useEffect(() => {
    if (!consumidorId || !campanhaId) return;
    const compute = async () => {
      setNumerosLoading(true);
      const { data: todos } = await supabase
        .from("cupons")
        .select("consumidor_id, quantidade")
        .eq("campanha_id", campanhaId)
        .eq("status", "validado")
        .order("criado_em", { ascending: true });
      if (!todos) { setNumerosLoading(false); return; }
      let cur = 1;
      const ranges: { start: number; end: number }[] = [];
      for (const c of todos) {
        const s = cur, e = cur + c.quantidade - 1;
        if (c.consumidor_id === consumidorId) ranges.push({ start: s, end: e });
        cur += c.quantidade;
      }
      setMeusNumeros(ranges);
      setNumerosLoading(false);
    };
    compute();
  }, [consumidorId, campanhaId]);

  const now = new Date();

  const cuponsFiltrados = useMemo(() => {
    if (periodo === "ciclo") return cupons;
    const ref = periodo === "anterior"
      ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const inicio = startOfMonth(ref).getTime();
    const fim = endOfMonth(ref).getTime();
    return cupons.filter((c) => {
      const t = new Date(c.data_pedido).getTime();
      return t >= inicio && t <= fim;
    });
  }, [cupons, periodo]);

  const cuponsMes = useMemo(
    () => cuponsFiltrados.reduce((s, c) => s + c.quantidade, 0),
    [cuponsFiltrados],
  );

  const chartData = useMemo(() => {
    const ref = periodo === "anterior"
      ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const dias = getDaysInMonth(ref);
    const map = new Map<number, number>();
    cuponsFiltrados.forEach((c) => {
      const d = new Date(c.data_pedido).getDate();
      map.set(d, (map.get(d) ?? 0) + c.quantidade);
    });
    return Array.from({ length: dias }, (_, i) => ({ dia: `${i + 1}`, cupons: map.get(i + 1) ?? 0 }));
  }, [cuponsFiltrados, periodo]);

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div>;
  }

  const paginados = cuponsFiltrados.slice(page * perPage, (page + 1) * perPage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Meus Cupons</h1>
        <p className="text-sm text-muted-foreground">Acompanhe seus cupons acumulados</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total acumulado</p>
              <p className="text-3xl font-bold font-heading text-primary">{totalCupons}</p>
            </div>
            <Ticket className="h-8 w-8 text-primary/40" />
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                {periodo === "anterior" ? "Cupons mês anterior" : periodo === "ciclo" ? "Cupons no ciclo" : "Cupons este mês"}
              </p>
              <p className="text-3xl font-bold font-heading">{cuponsMes}</p>
            </div>
            <CalendarDays className="h-8 w-8 text-primary/40" />
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Posição no ranking</p>
              <p className="text-3xl font-bold font-heading text-primary">
                {posicaoRanking ? `🏆 ${posicaoRanking}º` : "—"}
              </p>
            </div>
            <Trophy className="h-8 w-8 text-primary/40" />
          </CardContent>
        </Card>
      </div>

      {/* Números da Sorte */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">🍀 Meus Números da Sorte</CardTitle>
          <p className="text-xs text-muted-foreground">
            {numerosLoading
              ? "Calculando seus números..."
              : meusNumeros.length === 0
              ? "Faça seu primeiro pedido para receber números da sorte!"
              : `Você tem ${meusNumeros.reduce((s, r) => s + (r.end - r.start + 1), 0)} números da sorte`}
          </p>
        </CardHeader>
        <CardContent>
          {numerosLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Carregando...
            </div>
          ) : meusNumeros.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhum número ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {meusNumeros.flatMap((r, i) =>
                rangeToLucky(r.start, r.end).map((label, j) => (
                  <Badge key={`${i}-${j}`} variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                    {label}
                  </Badge>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Cupons por dia</CardTitle>
          <Select value={periodo} onValueChange={(v) => { setPeriodo(v); setPage(0); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="anterior">Mês anterior</SelectItem>
              <SelectItem value="ciclo">Todo o ciclo</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="dia" tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="cupons" fill="hsl(25 95% 53%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cupom neste período</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Histórico de cupons</CardTitle>
        </CardHeader>
        <CardContent>
          {paginados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum cupom neste período</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Pizzaria</TableHead>
                    <TableHead className="text-right">Valor do pedido</TableHead>
                    <TableHead className="text-center">Cupons</TableHead>
                    <TableHead className="text-center">Acumulado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginados.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-muted-foreground">
                        {c.data_pedido ? format(new Date(c.data_pedido), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </TableCell>
                      <TableCell>{c.pizzaria_nome}</TableCell>
                      <TableCell className="text-right">R$ {c.valor_pedido.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="border-primary/30 text-primary">{c.quantidade}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">{c.acumulado}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={(page + 1) * perPage >= cuponsFiltrados.length} onClick={() => setPage(page + 1)}>Próximo</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

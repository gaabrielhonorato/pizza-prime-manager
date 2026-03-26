import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket, Trophy, CalendarDays } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const chartData = Array.from({ length: 26 }, (_, i) => ({
  dia: `${i + 1}`,
  cupons: i === 4 ? 1 : i === 9 ? 3 : i === 14 ? 1 : i === 18 ? 2 : i === 21 ? 1 : 0,
}));

const historico = [
  { data: "22/03/2026", pizzaria: "Pizzaria do Zé", valor: 89.9, cupons: 1, acumulado: 47 },
  { data: "19/03/2026", pizzaria: "Pizzaria do Zé", valor: 124.5, cupons: 2, acumulado: 46 },
  { data: "15/03/2026", pizzaria: "Pizzaria do Zé", valor: 67.0, cupons: 1, acumulado: 44 },
  { data: "10/03/2026", pizzaria: "Pizzaria do Zé", valor: 155.0, cupons: 3, acumulado: 43 },
  { data: "05/03/2026", pizzaria: "Pizzaria do Zé", valor: 52.0, cupons: 1, acumulado: 40 },
  { data: "28/02/2026", pizzaria: "Pizzaria do Zé", valor: 98.0, cupons: 1, acumulado: 39 },
  { data: "20/02/2026", pizzaria: "Pizzaria do Zé", valor: 210.0, cupons: 4, acumulado: 38 },
  { data: "14/02/2026", pizzaria: "Pizzaria do Zé", valor: 75.5, cupons: 1, acumulado: 34 },
];

const chartConfig = { cupons: { label: "Cupons", color: "hsl(25 95% 53%)" } };

export default function ConsumidorCupons() {
  const [periodo, setPeriodo] = useState("mes");
  const [page, setPage] = useState(0);
  const perPage = 10;

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
              <p className="text-3xl font-bold font-heading text-primary">47</p>
            </div>
            <Ticket className="h-8 w-8 text-primary/40" />
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Cupons este mês</p>
              <p className="text-3xl font-bold font-heading">8</p>
            </div>
            <CalendarDays className="h-8 w-8 text-primary/40" />
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Posição no ranking</p>
              <p className="text-3xl font-bold font-heading text-primary">🏆 12º</p>
            </div>
            <Trophy className="h-8 w-8 text-primary/40" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Cupons por dia</CardTitle>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="anterior">Mês anterior</SelectItem>
              <SelectItem value="ciclo">Todo o ciclo</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
              <XAxis dataKey="dia" tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="cupons" fill="hsl(25 95% 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Histórico de cupons</CardTitle>
        </CardHeader>
        <CardContent>
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
              {historico.slice(page * perPage, (page + 1) * perPage).map((h, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground">{h.data}</TableCell>
                  <TableCell>{h.pizzaria}</TableCell>
                  <TableCell className="text-right">R$ {h.valor.toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="border-primary/30 text-primary">{h.cupons}</Badge>
                  </TableCell>
                  <TableCell className="text-center font-medium">{h.acumulado}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * perPage >= historico.length} onClick={() => setPage(page + 1)}>Próximo</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

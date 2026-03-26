import { Trophy, Calendar, Ticket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { premios, CICLO_MESES } from "@/data/mockData";
import { usePizzarias } from "@/contexts/PizzariasContext";

const trophyColors = ["text-yellow-400", "text-gray-400", "text-orange-600"];

export default function Sorteio() {
  const { pizzarias } = usePizzarias();
  const ativas = pizzarias.filter((p) => p.status === "Ativa");

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-bold">Sorteio</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {premios.map((p, i) => (
          <Card key={p.posicao} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Trophy className={`h-6 w-6 ${trophyColors[i]}`} />
              <CardTitle className="text-lg font-heading">{p.posicao} Prêmio</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{p.nome}</p>
              <p className="mt-1 font-heading text-lg text-primary">R$ {p.valor.toLocaleString("pt-BR")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center gap-3">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle className="font-heading">Cronograma do Ciclo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-muted-foreground">
            Duração: <span className="font-medium text-foreground">{CICLO_MESES} meses</span> — Janeiro a Abril 2025
          </p>
          <div className="flex gap-2">
            {["Jan", "Fev", "Mar", "Abr"].map((m, i) => (
              <Badge key={m} variant={i < 2 ? "default" : "secondary"} className="px-3 py-1">
                {m}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center gap-3">
          <Ticket className="h-5 w-5 text-primary" />
          <CardTitle className="font-heading">Pizzarias Participantes</CardTitle>
          <Badge variant="secondary" className="ml-auto">{ativas.length} ativas</Badge>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pizzaria</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead className="text-right">Cupons Acumulados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ativas.map((p) => {
                const cupons = Math.floor(Math.random() * 500) + 50;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>{p.cidade}</TableCell>
                    <TableCell className="text-right font-heading font-bold text-primary">{cupons}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

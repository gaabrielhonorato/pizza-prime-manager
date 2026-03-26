import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, ArrowUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ranking = [
  { pos: 1, nome: "Carlos M.", pizzaria: "Pizzaria Roma", cupons: 82 },
  { pos: 2, nome: "Ana P.", pizzaria: "Pizzaria do Zé", cupons: 78 },
  { pos: 3, nome: "Roberto L.", pizzaria: "Mega Pizza", cupons: 71 },
  { pos: 4, nome: "Fernanda C.", pizzaria: "Pizzaria do Zé", cupons: 68 },
  { pos: 5, nome: "Lucas R.", pizzaria: "Pizza Express", cupons: 65 },
  { pos: 6, nome: "Juliana S.", pizzaria: "Pizzaria Roma", cupons: 63 },
  { pos: 7, nome: "Pedro H.", pizzaria: "Mega Pizza", cupons: 60 },
  { pos: 8, nome: "Camila F.", pizzaria: "Pizzaria do Zé", cupons: 58 },
  { pos: 9, nome: "Marcos V.", pizzaria: "Pizza Express", cupons: 55 },
  { pos: 10, nome: "Beatriz A.", pizzaria: "Pizzaria Roma", cupons: 53 },
  { pos: 11, nome: "Thiago N.", pizzaria: "Mega Pizza", cupons: 50 },
  { pos: 12, nome: "Maria S.", pizzaria: "Pizzaria do Zé", cupons: 47 },
  { pos: 13, nome: "Rafael G.", pizzaria: "Pizza Express", cupons: 45 },
  { pos: 14, nome: "Patricia D.", pizzaria: "Pizzaria Roma", cupons: 42 },
  { pos: 15, nome: "Diego O.", pizzaria: "Pizzaria do Zé", cupons: 40 },
];

const trophyIcons: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const MINHA_POS = 12;

export default function ConsumidorRanking() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Ranking</h1>
        <p className="text-sm text-muted-foreground">Veja sua posição entre todos os participantes</p>
      </div>

      {/* Destaque posição */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Sua posição</p>
              <p className="text-5xl font-bold font-heading text-primary">12º</p>
            </div>
            <div className="h-16 w-px bg-border" />
            <div>
              <p className="text-sm text-muted-foreground">Total de cupons</p>
              <p className="text-2xl font-bold">47</p>
            </div>
            <div className="h-16 w-px bg-border" />
            <div className="flex items-center gap-2">
              <ArrowUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Para subir 1 posição</p>
                <p className="text-lg font-bold text-primary">Faltam 3 cupons</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela ranking */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Ranking Geral — Top 100
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Posição</TableHead>
                <TableHead>Participante</TableHead>
                <TableHead>Pizzaria</TableHead>
                <TableHead className="text-center">Cupons</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((r) => (
                <TableRow key={r.pos} className={r.pos === MINHA_POS ? "bg-primary/10 border-primary/30" : ""}>
                  <TableCell className="font-bold">
                    {trophyIcons[r.pos] ? (
                      <span className="text-lg">{trophyIcons[r.pos]}</span>
                    ) : (
                      <span className={r.pos === MINHA_POS ? "text-primary" : ""}>{r.pos}º</span>
                    )}
                  </TableCell>
                  <TableCell className={r.pos === MINHA_POS ? "text-primary font-semibold" : ""}>
                    {r.nome} {r.pos === MINHA_POS && <Badge className="ml-2 text-[10px]">Você</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.pizzaria}</TableCell>
                  <TableCell className="text-center font-bold">{r.cupons}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            O ranking exibe apenas o primeiro nome e inicial do sobrenome dos participantes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, ArrowUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConsumidorData } from "@/contexts/ConsumidorDataContext";

const trophyIcons: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function ConsumidorRanking() {
  const { ranking, totalCupons, posicaoRanking, cuponsFaltamProxima, loading } = useConsumidorData();

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando ranking...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Ranking</h1>
        <p className="text-sm text-muted-foreground">Veja sua posição entre todos os participantes</p>
      </div>

      {/* Destaque posição */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Sua posição</p>
              <p className="text-5xl font-bold font-heading text-primary">
                {posicaoRanking ? `${posicaoRanking}º` : "—"}
              </p>
            </div>
            <div className="h-16 w-px bg-border hidden sm:block" />
            <div>
              <p className="text-sm text-muted-foreground">Total de cupons</p>
              <p className="text-2xl font-bold">{totalCupons}</p>
            </div>
            {posicaoRanking && posicaoRanking > 1 && cuponsFaltamProxima > 0 && (
              <>
                <div className="h-16 w-px bg-border hidden sm:block" />
                <div className="flex items-center gap-2">
                  <ArrowUp className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Para subir 1 posição</p>
                    <p className="text-lg font-bold text-primary">Faltam {cuponsFaltamProxima} cupom{cuponsFaltamProxima !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </>
            )}
            {posicaoRanking === 1 && (
              <>
                <div className="h-16 w-px bg-border hidden sm:block" />
                <p className="text-lg font-bold text-primary">🥇 Você está em 1º lugar!</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela ranking */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Ranking Geral — Top {ranking.length}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum participante ainda.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Posição</TableHead>
                    <TableHead>Participante</TableHead>
                    <TableHead className="text-center">Cupons</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((r) => (
                    <TableRow key={r.consumidor_id} className={r.e_voce ? "bg-primary/10 border-primary/30" : ""}>
                      <TableCell className="font-bold">
                        {trophyIcons[r.pos] ? (
                          <span className="text-lg">{trophyIcons[r.pos]}</span>
                        ) : (
                          <span className={r.e_voce ? "text-primary" : ""}>{r.pos}º</span>
                        )}
                      </TableCell>
                      <TableCell className={r.e_voce ? "text-primary font-semibold" : ""}>
                        {r.nome_display}
                        {r.e_voce && <Badge className="ml-2 text-[10px]">Você</Badge>}
                      </TableCell>
                      <TableCell className="text-center font-bold">{r.total_cupons}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                O ranking exibe apenas o primeiro nome e inicial do sobrenome dos participantes.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

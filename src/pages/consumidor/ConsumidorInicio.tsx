import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket, Trophy, ShoppingBag, ArrowUp, Gift } from "lucide-react";
import { useCampanha } from "@/contexts/CampanhaContext";
import { useConsumidorData } from "@/contexts/ConsumidorDataContext";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ConsumidorInicio() {
  const { config } = useCampanha();
  const { totalCupons, posicaoRanking, totalPedidos, cuponsFaltamProxima, cupons, loading } = useConsumidorData();

  const dataSorteio = config.dataSorteio ? new Date(config.dataSorteio) : null;
  const agora = new Date();
  const diffMs = dataSorteio ? dataSorteio.getTime() - agora.getTime() : 0;
  const hasCampanha = dataSorteio && diffMs > 0;
  const dias = hasCampanha ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : 0;
  const horas = hasCampanha ? Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)) : 0;
  const minutos = hasCampanha ? Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)) : 0;

  const ultimosCupons = cupons.slice(0, 5);

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando seus dados...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-xl bg-gradient-to-r from-primary/90 to-primary/60 p-6 text-primary-foreground">
        <h2 className="font-heading text-xl font-bold">{config.nome}</h2>
        {hasCampanha ? (
          <>
            <p className="text-sm opacity-90 mt-1">Sorteio em</p>
            <div className="flex gap-4 mt-3">
              {[{ v: dias, l: "dias" }, { v: horas, l: "horas" }, { v: minutos, l: "min" }].map((t) => (
                <div key={t.l} className="text-center">
                  <span className="text-3xl font-bold font-heading">{t.v}</span>
                  <p className="text-xs opacity-80">{t.l}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm opacity-90 mt-2">Aguardando próxima campanha</p>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Meus Cupons</p>
                <p className="text-3xl font-bold font-heading text-primary">{totalCupons}</p>
              </div>
              <Ticket className="h-8 w-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Posição no Ranking</p>
                <p className="text-3xl font-bold font-heading text-primary">
                  {posicaoRanking ? `🏆 ${posicaoRanking}º` : "—"}
                </p>
              </div>
              <Trophy className="h-8 w-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pedidos no Ciclo</p>
                <p className="text-3xl font-bold font-heading">{totalPedidos}</p>
              </div>
              <ShoppingBag className="h-8 w-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Para subir 1 posição</p>
                <p className="text-3xl font-bold font-heading">
                  {posicaoRanking === 1 ? "🥇 1º!" : cuponsFaltamProxima > 0 ? `${cuponsFaltamProxima} cupons` : "—"}
                </p>
              </div>
              <ArrowUp className="h-8 w-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prêmios */}
      {config.premios.length > 0 && (
        <Card className="border-primary/30 bg-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" /> Prêmios da Campanha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.premios.slice(0, 3).map((p, i) => (
              <div key={p.id} className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                </div>
                <div>
                  <p className="font-semibold text-sm">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.ganhadores} ganhador{p.ganhadores !== 1 ? "es" : ""}</p>
                </div>
              </div>
            ))}
            <Link to="/consumidor/premios" className="text-xs text-primary hover:underline block mt-1">
              Ver regulamento completo →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Últimos cupons */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Últimos cupons gerados</CardTitle>
          <Link to="/consumidor/cupons" className="text-xs text-primary hover:underline">Ver todos</Link>
        </CardHeader>
        <CardContent>
          {ultimosCupons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum cupom ainda. Faça um pedido em uma pizzaria parceira!</p>
          ) : (
            <div className="space-y-2">
              {ultimosCupons.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs w-24">
                      {c.data_pedido ? format(new Date(c.data_pedido), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    </span>
                    <span className="truncate max-w-[140px]">{c.pizzaria_nome}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">R$ {c.valor_pedido.toFixed(2)}</span>
                    <Badge variant="outline" className="border-primary/30 text-primary">
                      {c.quantidade} cupom{c.quantidade > 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket, Trophy, ShoppingBag, ArrowUp, Gift } from "lucide-react";
import { useCampanha } from "@/contexts/CampanhaContext";
import { Link } from "react-router-dom";

const ultimosCupons = [
  { data: "22/03/2026", pizzaria: "Pizzaria do Zé", valorPedido: 89.9, cupons: 1 },
  { data: "19/03/2026", pizzaria: "Pizzaria do Zé", valorPedido: 124.5, cupons: 2 },
  { data: "15/03/2026", pizzaria: "Pizzaria do Zé", valorPedido: 67.0, cupons: 1 },
  { data: "10/03/2026", pizzaria: "Pizzaria do Zé", valorPedido: 155.0, cupons: 3 },
  { data: "05/03/2026", pizzaria: "Pizzaria do Zé", valorPedido: 52.0, cupons: 1 },
];

export default function ConsumidorInicio() {
  const { config } = useCampanha();

  const dataSorteio = config.dataSorteio ? new Date(config.dataSorteio) : null;
  const agora = new Date();
  const diffMs = dataSorteio ? dataSorteio.getTime() - agora.getTime() : 0;
  const dias = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const horas = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const minutos = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-xl bg-gradient-to-r from-primary/90 to-primary/60 p-6 text-primary-foreground">
        <h2 className="font-heading text-xl font-bold">{config.nome}</h2>
        <p className="text-sm opacity-90 mt-1">Sorteio em</p>
        <div className="flex gap-4 mt-3">
          {[{ v: dias, l: "dias" }, { v: horas, l: "horas" }, { v: minutos, l: "min" }].map((t) => (
            <div key={t.l} className="text-center">
              <span className="text-3xl font-bold font-heading">{t.v}</span>
              <p className="text-xs opacity-80">{t.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Meus Cupons</p>
                <p className="text-3xl font-bold font-heading text-primary">47</p>
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
                <p className="text-3xl font-bold font-heading text-primary">🏆 12º</p>
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
                <p className="text-3xl font-bold font-heading">8</p>
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
                <p className="text-3xl font-bold font-heading">3 cupons</p>
              </div>
              <ArrowUp className="h-8 w-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prêmio mais próximo */}
      <Card className="border-primary/30 bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" /> Próximo prêmio mais próximo de mim
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center text-2xl">🎁</div>
            <div>
              <p className="font-semibold">Pix R$1.000</p>
              <p className="text-sm text-muted-foreground">3º Prêmio — 3 ganhadores</p>
              <p className="text-sm text-primary mt-1 font-medium">
                Você está a 3 cupons do 11º lugar! Peça mais uma pizza e suba no ranking 🍕
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Últimos cupons */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Últimos cupons gerados</CardTitle>
          <Link to="/consumidor/cupons" className="text-xs text-primary hover:underline">Ver todos</Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {ultimosCupons.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs w-20">{c.data}</span>
                  <span>{c.pizzaria}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">R$ {c.valorPedido.toFixed(2)}</span>
                  <Badge variant="outline" className="border-primary/30 text-primary">{c.cupons} cupom{c.cupons > 1 ? "s" : ""}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

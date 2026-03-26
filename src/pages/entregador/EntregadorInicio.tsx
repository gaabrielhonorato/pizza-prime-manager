import { Package, Clock, Truck, Timer, MapPin, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const stats = [
  { label: "Entregas hoje", value: "5", icon: Truck },
  { label: "Pendentes agora", value: "2", icon: Package },
  { label: "Total no ciclo", value: "87", icon: CheckCircle2 },
  { label: "Tempo médio", value: "28 min", icon: Timer },
];

const proximaEntrega = {
  pedido: "#1247",
  cliente: "Maria Silva",
  endereco: "Rua das Palmeiras, 320 - Centro, São Paulo - SP",
  valor: "R$ 78,90",
  horario: "14:35",
};

const entregasHoje = [
  { horario: "11:20", cliente: "Carlos Oliveira", endereco: "Av. Paulista, 1000 - Bela Vista", status: "Concluído" },
  { horario: "12:05", cliente: "Ana Santos", endereco: "Rua Augusta, 450 - Consolação", status: "Concluído" },
  { horario: "13:15", cliente: "Pedro Lima", endereco: "Rua Oscar Freire, 780 - Jardins", status: "Concluído" },
  { horario: "13:50", cliente: "Juliana Costa", endereco: "Av. Rebouças, 1200 - Pinheiros", status: "Em andamento" },
  { horario: "14:35", cliente: "Maria Silva", endereco: "Rua das Palmeiras, 320 - Centro", status: "Pendente" },
];

const statusColor: Record<string, string> = {
  "Concluído": "bg-green-500/20 text-green-400",
  "Em andamento": "bg-yellow-500/20 text-yellow-400",
  "Pendente": "bg-muted text-muted-foreground",
};

export default function EntregadorInicio() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Olá, João Entregador 👋</h1>
        <p className="text-muted-foreground text-sm">Pizzaria do Zé</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Próxima entrega */}
      <Card className="border-primary/30 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Próxima entrega
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Pedido</p>
              <p className="font-semibold">{proximaEntrega.pedido}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Cliente</p>
              <p className="font-semibold">{proximaEntrega.cliente}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Valor</p>
              <p className="font-semibold">{proximaEntrega.valor}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Horário</p>
              <p className="font-semibold">{proximaEntrega.horario}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p>{proximaEntrega.endereco}</p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => navigate("/entregador/app/mapa")}>
              <MapPin className="mr-1 h-4 w-4" /> Ver no mapa
            </Button>
            <Button size="sm" variant="outline" className="border-green-500/50 text-green-400 hover:bg-green-500/10">
              <CheckCircle2 className="mr-1 h-4 w-4" /> Marcar como entregue
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Entregas de hoje */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Entregas de hoje</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {entregasHoje.map((e, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground font-mono text-xs w-12">{e.horario}</span>
                  <div>
                    <p className="font-medium">{e.cliente}</p>
                    <p className="text-xs text-muted-foreground">{e.endereco}</p>
                  </div>
                </div>
                <Badge variant="secondary" className={statusColor[e.status]}>{e.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

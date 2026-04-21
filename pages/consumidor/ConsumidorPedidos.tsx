import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ticket, ShoppingBag } from "lucide-react";

const pedidos = [
  { id: "#2847", data: "22/03/2026 19:45", pizzaria: "Pizzaria do Zé", itens: "1x Calabresa G, 1x Coca-Cola 2L", valor: 89.9, cupons: 1, status: "Concluído" },
  { id: "#2831", data: "19/03/2026 20:10", pizzaria: "Pizzaria do Zé", itens: "2x Margherita G, 1x Guaraná", valor: 124.5, cupons: 2, status: "Concluído" },
  { id: "#2815", data: "15/03/2026 18:30", pizzaria: "Pizzaria do Zé", itens: "1x Portuguesa M", valor: 67.0, cupons: 1, status: "Concluído" },
  { id: "#2798", data: "10/03/2026 21:00", pizzaria: "Pizzaria do Zé", itens: "3x Frango c/ Catupiry G, 2x Suco", valor: 155.0, cupons: 3, status: "Concluído" },
  { id: "#2780", data: "05/03/2026 19:15", pizzaria: "Pizzaria do Zé", itens: "1x Napolitana M", valor: 52.0, cupons: 1, status: "Concluído" },
  { id: "#2756", data: "28/02/2026 20:30", pizzaria: "Pizzaria do Zé", itens: "1x 4 Queijos G, 1x Água", valor: 98.0, cupons: 1, status: "Concluído" },
  { id: "#2720", data: "20/02/2026 19:00", pizzaria: "Pizzaria do Zé", itens: "4x Pizza G variadas, 3x Refri", valor: 210.0, cupons: 4, status: "Concluído" },
  { id: "#2690", data: "14/02/2026 18:45", pizzaria: "Pizzaria do Zé", itens: "1x Mussarela G, 1x Suco", valor: 75.5, cupons: 1, status: "Cancelado" },
];

export default function ConsumidorPedidos() {
  const [periodo, setPeriodo] = useState("ciclo");
  const [pizzaria, setPizzaria] = useState("todas");

  const filtered = pedidos;
  const totalValor = filtered.reduce((s, p) => s + (p.status === "Concluído" ? p.valor : 0), 0);
  const totalCupons = filtered.reduce((s, p) => s + (p.status === "Concluído" ? p.cupons : 0), 0);
  const concluidos = filtered.filter((p) => p.status === "Concluído");
  const ticketMedio = concluidos.length ? totalValor / concluidos.length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Meus Pedidos</h1>
        <p className="text-sm text-muted-foreground">Histórico completo dos seus pedidos</p>
      </div>

      <div className="flex gap-3">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Este mês</SelectItem>
            <SelectItem value="anterior">Mês anterior</SelectItem>
            <SelectItem value="ciclo">Todo o ciclo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={pizzaria} onValueChange={setPizzaria}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as pizzarias</SelectItem>
            <SelectItem value="ze">Pizzaria do Zé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.map((p) => (
          <Card key={p.id} className="border-border bg-card hover:border-primary/20 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-heading">{p.id}</span>
                    <Badge variant={p.status === "Concluído" ? "default" : "destructive"} className={p.status === "Concluído" ? "bg-green-600/20 text-green-400 border-green-600/30" : ""}>
                      {p.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.data}</p>
                  <p className="text-sm">{p.pizzaria}</p>
                  <p className="text-sm text-muted-foreground">{p.itens}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="font-bold text-lg">R$ {p.valor.toFixed(2)}</p>
                  <div className="flex items-center gap-1 justify-end">
                    <Ticket className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm text-primary font-medium">{p.cupons} cupom{p.cupons > 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Totais */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Total de pedidos</p>
              <p className="text-xl font-bold">{concluidos.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total gasto</p>
              <p className="text-xl font-bold">R$ {totalValor.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ticket médio</p>
              <p className="text-xl font-bold">R$ {ticketMedio.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de cupons</p>
              <p className="text-xl font-bold text-primary">{totalCupons}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

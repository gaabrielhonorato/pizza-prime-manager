import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ticket } from "lucide-react";
import { useConsumidorData } from "@/contexts/ConsumidorDataContext";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const CANAL_LABELS: Record<string, string> = {
  cardapioweb: "Cardápio Web",
  whatsapp: "WhatsApp",
  balcao: "Balcão",
  anuncios: "Anúncios",
  outros: "Outros",
};

const TIPO_LABELS: Record<string, string> = {
  delivery: "Delivery",
  retirada: "Retirada",
  local: "Local",
};

const PGTO_LABELS: Record<string, string> = {
  pix: "Pix",
  cartao_credito: "Crédito",
  cartao_debito: "Débito",
  dinheiro: "Dinheiro",
};

export default function ConsumidorPedidos() {
  const { pedidos, loading } = useConsumidorData();
  const [periodo, setPeriodo] = useState("ciclo");

  const now = new Date();

  const filtrados = useMemo(() => {
    if (periodo === "ciclo") return pedidos;
    const ref = periodo === "anterior"
      ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const inicio = startOfMonth(ref).getTime();
    const fim = endOfMonth(ref).getTime();
    return pedidos.filter((p) => {
      const t = new Date(p.data_pedido).getTime();
      return t >= inicio && t <= fim;
    });
  }, [pedidos, periodo]);

  const entregues = useMemo(() => filtrados.filter((p) => p.status === "entregue"), [filtrados]);
  const totalValor = useMemo(() => entregues.reduce((s, p) => s + p.valor_total, 0), [entregues]);
  const totalCupons = useMemo(() => entregues.reduce((s, p) => s + p.cupons_gerados, 0), [entregues]);
  const ticketMedio = entregues.length > 0 ? totalValor / entregues.length : 0;

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div>;
  }

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
      </div>

      {filtrados.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum pedido neste período.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map((p) => (
            <Card key={p.id} className="border-border bg-card hover:border-primary/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={p.status === "entregue" ? "default" : "destructive"}
                        className={p.status === "entregue" ? "bg-green-600/20 text-green-400 border-green-600/30" : ""}
                      >
                        {p.status === "entregue" ? "Concluído" : p.status}
                      </Badge>
                      {p.tipo_pedido && (
                        <span className="text-xs text-muted-foreground">{TIPO_LABELS[p.tipo_pedido] ?? p.tipo_pedido}</span>
                      )}
                      {p.canal && (
                        <span className="text-xs text-muted-foreground">· {CANAL_LABELS[p.canal] ?? p.canal}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.data_pedido ? format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                    </p>
                    <p className="text-sm font-medium">{p.pizzaria_nome}</p>
                    {p.forma_pagamento && (
                      <p className="text-xs text-muted-foreground">{PGTO_LABELS[p.forma_pagamento] ?? p.forma_pagamento}</p>
                    )}
                  </div>
                  <div className="text-right space-y-1 shrink-0 ml-4">
                    <p className="font-bold text-lg">R$ {p.valor_total.toFixed(2)}</p>
                    {p.taxa_entrega > 0 && (
                      <p className="text-xs text-muted-foreground">+R$ {p.taxa_entrega.toFixed(2)} entrega</p>
                    )}
                    {p.cupons_gerados > 0 && (
                      <div className="flex items-center gap-1 justify-end">
                        <Ticket className="h-3.5 w-3.5 text-primary" />
                        <span className="text-sm text-primary font-medium">
                          {p.cupons_gerados} cupom{p.cupons_gerados > 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filtrados.length > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Total de pedidos</p>
                <p className="text-xl font-bold">{entregues.length}</p>
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
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

type Pedido = {
  id: string; data_pedido: string; valor_total: number; cupons_gerados: number;
  canal: string; status: string; forma_pagamento: string | null;
  tipo_pedido: string | null; taxa_entrega: number; desconto: number;
  bairro_entrega: string | null; horario_pedido: string | null;
  pizzaria_id: string; campanha_id: string;
};

const FORMAS_LABELS: Record<string, string> = {
  cartao_credito: "Cartão de crédito", cartao_debito: "Cartão de débito", pix: "Pix",
  dinheiro: "Dinheiro", voucher: "Voucher", outros: "Outros",
};

const TIPO_LABELS: Record<string, string> = {
  delivery: "🛵 Delivery", retirada: "🛍️ Retirada", local: "🍽️ No local",
};

const STATUS_LABELS: Record<string, string> = {
  entregue: "Entregue", cancelado: "Cancelado", pendente: "Pendente",
  em_preparo: "Em preparo", saiu_entrega: "Saiu para entrega",
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  pedido: Pedido | null;
  pizzariaNome: string;
  luckyNumbers: number[];
  onClose: () => void;
}

type Campanha = { nome: string; valor_por_cupom: number } | null;

export default function PedidoDetalheDialog({ pedido, pizzariaNome, luckyNumbers, onClose }: Props) {
  const [campanha, setCampanha] = useState<Campanha>(null);
  const [loadingCamp, setLoadingCamp] = useState(false);

  useEffect(() => {
    if (!pedido?.campanha_id) { setCampanha(null); return; }
    setLoadingCamp(true);
    supabase
      .from("campanhas")
      .select("nome, valor_por_cupom")
      .eq("id", pedido.campanha_id)
      .single()
      .then(({ data }) => { setCampanha(data ?? null); setLoadingCamp(false); });
  }, [pedido?.campanha_id]);

  if (!pedido) return null;

  const dataHora = format(new Date(pedido.data_pedido), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const tipo = TIPO_LABELS[pedido.tipo_pedido ?? "delivery"] ?? pedido.tipo_pedido ?? "—";
  const canal = pedido.canal === "cardapioweb" ? "App (Cardápio Web)" : pedido.canal === "manual" ? "Manual" : pedido.canal;
  const forma = FORMAS_LABELS[pedido.forma_pagamento ?? "outros"] ?? pedido.forma_pagamento ?? "—";
  const status = STATUS_LABELS[pedido.status] ?? pedido.status ?? "—";

  // ── Diagnóstico de cupom ──
  type DiagLevel = "ok" | "warn" | "info";
  let diagMsg = "";
  let diagLevel: DiagLevel = "info";

  if (pedido.cupons_gerados > 0) {
    diagMsg = `${pedido.cupons_gerados} cupom${pedido.cupons_gerados > 1 ? "s" : ""} gerado${pedido.cupons_gerados > 1 ? "s" : ""} normalmente.`;
    diagLevel = "ok";
  } else if (pedido.status === "cancelado") {
    diagMsg = "Pedido cancelado — cupons não são gerados para pedidos cancelados.";
    diagLevel = "warn";
  } else if (pedido.canal === "manual") {
    diagMsg = "Pedido inserido manualmente — pedidos manuais não geram cupons automaticamente.";
    diagLevel = "warn";
  } else if (!pedido.campanha_id) {
    diagMsg = "Sem campanha ativa vinculada a este pedido.";
    diagLevel = "warn";
  } else if (loadingCamp) {
    diagMsg = "Verificando regras da campanha…";
    diagLevel = "info";
  } else if (campanha) {
    const valorMin = Number(campanha.valor_por_cupom);
    if (valorMin > 0 && pedido.valor_total < valorMin) {
      diagMsg = `Campanha "${campanha.nome}" exige valor mínimo de ${fmtBRL(valorMin)} por cupom. Este pedido (${fmtBRL(pedido.valor_total)}) ficou abaixo do limite.`;
      diagLevel = "warn";
    } else if (valorMin > 0) {
      diagMsg = `Campanha "${campanha.nome}" — valor mínimo ${fmtBRL(valorMin)} por cupom. O pedido atende o critério, mas nenhum cupom foi registrado. Verifique se o pedido chegou via App.`;
      diagLevel = "warn";
    } else {
      diagMsg = `Campanha "${campanha.nome}" vinculada, mas nenhum cupom foi gerado. Verifique se o pedido chegou via App.`;
      diagLevel = "warn";
    }
  } else {
    diagMsg = "Não foi possível identificar o motivo. Campanha não encontrada.";
    diagLevel = "info";
  }

  const DiagIcon = diagLevel === "ok" ? CheckCircle2 : diagLevel === "warn" ? AlertCircle : Info;
  const diagColor = diagLevel === "ok" ? "text-emerald-600" : diagLevel === "warn" ? "text-amber-600" : "text-muted-foreground";
  const diagBg = diagLevel === "ok" ? "bg-emerald-50 dark:bg-emerald-950/30" : diagLevel === "warn" ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted";

  return (
    <Dialog open={!!pedido} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Detalhe do Pedido</DialogTitle>
          <DialogDescription className="text-xs">{dataHora} · {pizzariaNome}</DialogDescription>
        </DialogHeader>

        {/* Informações gerais */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Valor total</p>
            <p className="font-semibold text-base">{fmtBRL(pedido.valor_total)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Status</p>
            <p className="font-medium">{status}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Tipo</p>
            <p className="font-medium">{tipo}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Canal</p>
            <p className="font-medium">{canal}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Forma de pagamento</p>
            <p className="font-medium">{forma}</p>
          </div>
          {pedido.bairro_entrega && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Bairro</p>
              <p className="font-medium">{pedido.bairro_entrega}</p>
            </div>
          )}
          {pedido.taxa_entrega > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Taxa de entrega</p>
              <p className="font-medium">{fmtBRL(pedido.taxa_entrega)}</p>
            </div>
          )}
          {pedido.desconto > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Desconto</p>
              <p className="font-medium text-amber-600">– {fmtBRL(pedido.desconto)}</p>
            </div>
          )}
          {campanha && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-0.5">Campanha</p>
              <p className="font-medium">{campanha.nome}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Cupons */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cupons</p>
            <Badge variant={pedido.cupons_gerados > 0 ? "default" : "secondary"}>
              {pedido.cupons_gerados} cupom{pedido.cupons_gerados !== 1 ? "s" : ""}
            </Badge>
          </div>

          {luckyNumbers.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Números da sorte</p>
              <div className="flex flex-wrap gap-1">
                {luckyNumbers.map((n, i) => (
                  <span key={i} className="inline-block font-mono text-xs bg-secondary border border-border rounded px-2 py-0.5">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Diagnóstico */}
          <div className={`flex gap-2.5 rounded-lg p-3 ${diagBg}`}>
            <DiagIcon className={`h-4 w-4 mt-0.5 shrink-0 ${diagColor}`} />
            <p className={`text-xs leading-relaxed ${diagColor}`}>{diagMsg}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

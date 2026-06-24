import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, AlertCircle, Info, User } from "lucide-react";
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
  pizzaria_id: string; campanha_id: string; consumidor_id: string | null;
};

type Consumidor = {
  id: string;
  bairro: string | null;
  cidade: string | null;
  cadastro_completo: boolean;
  usuarios: { nome: string; telefone: string | null; email: string } | null;
} | null;

type Cupon = { id: string; quantidade: number; status: string; criado_em: string };

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
  luckyNumbers: string[];
  onClose: () => void;
}

export default function PedidoDetalheDialog({ pedido, pizzariaNome, luckyNumbers, onClose }: Props) {
  const [consumidor, setConsumidor] = useState<Consumidor>(null);
  const [cupons, setCupons] = useState<Cupon[]>([]);
  const [campanha, setCampanha] = useState<{ nome: string; valor_por_cupom: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pedido) { setConsumidor(null); setCupons([]); setCampanha(null); return; }
    setLoading(true);

    const queries: Promise<void>[] = [];

    if (pedido.consumidor_id) {
      queries.push(
        supabase.from("consumidores")
          .select("id, bairro, cidade, cadastro_completo, usuarios:usuario_id(nome, telefone, email)")
          .eq("id", pedido.consumidor_id)
          .single()
          .then(({ data }) => { setConsumidor(data as Consumidor); })
      );
    } else {
      setConsumidor(null);
    }

    queries.push(
      supabase.from("cupons")
        .select("id, quantidade, status, criado_em")
        .eq("pedido_id", pedido.id)
        .order("criado_em", { ascending: true })
        .then(({ data }) => { setCupons((data as Cupon[]) ?? []); })
    );

    if (pedido.campanha_id) {
      queries.push(
        supabase.from("campanhas")
          .select("nome, valor_por_cupom")
          .eq("id", pedido.campanha_id)
          .single()
          .then(({ data }) => { setCampanha(data ?? null); })
      );
    } else {
      setCampanha(null);
    }

    Promise.all(queries).then(() => setLoading(false));
  }, [pedido?.id]);

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
  } else if (loading) {
    diagMsg = "Verificando regras da campanha…";
    diagLevel = "info";
  } else if (campanha) {
    const valorMin = Number(campanha.valor_por_cupom);
    if (valorMin > 0 && pedido.valor_total < valorMin) {
      diagMsg = `Campanha "${campanha.nome}" exige mínimo de ${fmtBRL(valorMin)} por cupom. Este pedido (${fmtBRL(pedido.valor_total)}) ficou abaixo do limite.`;
      diagLevel = "warn";
    } else {
      diagMsg = `Campanha "${campanha.nome}" vinculada, mas nenhum cupom registrado. Verifique se o pedido chegou via App.`;
      diagLevel = "warn";
    }
  } else {
    diagMsg = "Não foi possível identificar o motivo.";
    diagLevel = "info";
  }

  const DiagIcon = diagLevel === "ok" ? CheckCircle2 : diagLevel === "warn" ? AlertCircle : Info;
  const diagColor = diagLevel === "ok" ? "text-emerald-600" : diagLevel === "warn" ? "text-amber-600" : "text-muted-foreground";
  const diagBg   = diagLevel === "ok" ? "bg-emerald-50 dark:bg-emerald-950/30" : diagLevel === "warn" ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted";

  const nomeConsumidor = (consumidor?.usuarios as any)?.nome ?? null;
  const telefone = (consumidor?.usuarios as any)?.telefone ?? null;
  const email    = (consumidor?.usuarios as any)?.email ?? null;

  return (
    <Dialog open={!!pedido} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Detalhe do Pedido</DialogTitle>
          <DialogDescription className="text-xs">{dataHora} · {pizzariaNome}</DialogDescription>
        </DialogHeader>

        {/* ── Informações gerais ── */}
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

        {/* ── Consumidor ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Consumidor</p>
          </div>

          {!pedido.consumidor_id ? (
            <p className="text-sm text-muted-foreground">Sem consumidor vinculado — pedido anônimo ou manual.</p>
          ) : loading ? (
            <p className="text-xs text-muted-foreground">Carregando…</p>
          ) : consumidor ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-0.5">Nome</p>
                <p className="font-medium">{nomeConsumidor ?? "—"}</p>
              </div>
              {telefone && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Telefone</p>
                  <p className="font-medium">{telefone}</p>
                </div>
              )}
              {email && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">E-mail</p>
                  <p className="font-medium break-all">{email}</p>
                </div>
              )}
              {(consumidor.bairro || consumidor.cidade) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Localização</p>
                  <p className="font-medium">{[consumidor.bairro, consumidor.cidade].filter(Boolean).join(", ")}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Cadastro</p>
                <Badge variant={consumidor.cadastro_completo ? "default" : "secondary"} className="text-[10px]">
                  {consumidor.cadastro_completo ? "Completo" : "Pendente"}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Consumidor não encontrado.</p>
          )}
        </div>

        <Separator />

        {/* ── Cupons & Números da Sorte ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cupons</p>
            <Badge variant={pedido.cupons_gerados > 0 ? "default" : "secondary"}>
              {pedido.cupons_gerados} cupom{pedido.cupons_gerados !== 1 ? "s" : ""}
            </Badge>
          </div>

          {cupons.length > 0 && (
            <div className="space-y-1.5">
              {cupons.map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    {format(new Date(c.criado_em), "dd/MM/yyyy HH:mm")} · {c.quantidade} cupom{c.quantidade !== 1 ? "s" : ""}
                  </span>
                  <Badge variant={c.status === "validado" ? "default" : "secondary"} className="text-[10px]">
                    {c.status === "validado" ? "Validado" : c.status === "pendente" ? "Pendente" : c.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}

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

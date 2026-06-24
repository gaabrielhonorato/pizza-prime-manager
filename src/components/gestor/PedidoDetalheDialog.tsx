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

const CANAL_LABELS: Record<string, string> = {
  cardapioweb: "App (Cardápio Web)", manual: "Manual", balcao: "Balcão",
};

const STATUS_LABELS: Record<string, string> = {
  entregue: "Entregue", cancelado: "Cancelado", pendente: "Pendente",
  em_preparo: "Em preparo", saiu_entrega: "Saiu para entrega",
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium leading-snug">{value}</p>
    </div>
  );
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
          .eq("id", pedido.consumidor_id).single()
          .then(({ data }) => { setConsumidor(data as Consumidor); })
      );
    } else {
      setConsumidor(null);
    }

    queries.push(
      supabase.from("cupons")
        .select("id, quantidade, status, criado_em")
        .eq("pedido_id", pedido.id).order("criado_em", { ascending: true })
        .then(({ data }) => { setCupons((data as Cupon[]) ?? []); })
    );

    if (pedido.campanha_id) {
      queries.push(
        supabase.from("campanhas").select("nome, valor_por_cupom")
          .eq("id", pedido.campanha_id).single()
          .then(({ data }) => { setCampanha(data ?? null); })
      );
    } else {
      setCampanha(null);
    }

    Promise.all(queries).then(() => setLoading(false));
  }, [pedido?.id]);

  if (!pedido) return null;

  const dataHora = format(new Date(pedido.data_pedido), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const tipo   = TIPO_LABELS[pedido.tipo_pedido ?? "delivery"] ?? pedido.tipo_pedido ?? "—";
  const canal  = CANAL_LABELS[pedido.canal] ?? pedido.canal;
  const forma  = FORMAS_LABELS[pedido.forma_pagamento ?? "outros"] ?? pedido.forma_pagamento ?? "—";
  const status = STATUS_LABELS[pedido.status] ?? pedido.status ?? "—";

  const nomeConsumidor = (consumidor?.usuarios as any)?.nome ?? null;
  const telefone = (consumidor?.usuarios as any)?.telefone ?? null;
  const email    = (consumidor?.usuarios as any)?.email ?? null;

  // ── Diagnóstico ──
  type DiagLevel = "ok" | "warn" | "info";
  let diagMsg = "";
  let diagLevel: DiagLevel = "info";

  if (pedido.cupons_gerados > 0 && cupons.length === 0 && !loading) {
    // Cupons contabilizados no pedido mas sem registros físicos
    diagMsg = `O pedido registrou ${pedido.cupons_gerados} cupom${pedido.cupons_gerados > 1 ? "s" : ""}, mas nenhum registro foi criado na tabela de cupons. Pedidos do canal "${canal}" não geram registros automáticos de cupom — os números da sorte não são atribuídos.`;
    diagLevel = "warn";
  } else if (pedido.cupons_gerados > 0 && cupons.length > 0) {
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
    diagMsg = "Verificando…";
    diagLevel = "info";
  } else if (campanha) {
    const valorMin = Number(campanha.valor_por_cupom);
    if (valorMin > 0 && pedido.valor_total < valorMin) {
      diagMsg = `Campanha "${campanha.nome}" exige mínimo de ${fmtBRL(valorMin)} por cupom. Este pedido (${fmtBRL(pedido.valor_total)}) ficou abaixo do limite.`;
    } else {
      diagMsg = `Campanha "${campanha.nome}" vinculada, mas nenhum cupom registrado. Verifique se o pedido chegou via App.`;
    }
    diagLevel = "warn";
  } else {
    diagMsg = "Não foi possível identificar o motivo.";
    diagLevel = "info";
  }

  const DiagIcon = diagLevel === "ok" ? CheckCircle2 : diagLevel === "warn" ? AlertCircle : Info;
  const diagColor = diagLevel === "ok" ? "text-emerald-600" : diagLevel === "warn" ? "text-amber-600" : "text-muted-foreground";
  const diagBg   = diagLevel === "ok" ? "bg-emerald-50 dark:bg-emerald-950/30" : diagLevel === "warn" ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted";

  return (
    <Dialog open={!!pedido} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw]">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-base">Detalhe do Pedido</DialogTitle>
          <DialogDescription className="text-xs">{dataHora} · {pizzariaNome}</DialogDescription>
        </DialogHeader>

        {/* ── Linha superior: Pedido | Consumidor ── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Pedido */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Pedido</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <InfoRow label="Valor total" value={<span className="text-base font-bold">{fmtBRL(pedido.valor_total)}</span>} />
              <InfoRow label="Status" value={status} />
              <InfoRow label="Tipo" value={tipo} />
              <InfoRow label="Canal" value={canal} />
              <InfoRow label="Pagamento" value={forma} />
              {pedido.bairro_entrega && <InfoRow label="Bairro" value={pedido.bairro_entrega} />}
              {pedido.taxa_entrega > 0 && <InfoRow label="Taxa entrega" value={fmtBRL(pedido.taxa_entrega)} />}
              {pedido.desconto > 0 && <InfoRow label="Desconto" value={<span className="text-amber-600">– {fmtBRL(pedido.desconto)}</span>} />}
            </div>
            {campanha && (
              <div className="pt-1">
                <InfoRow label="Campanha" value={campanha.nome} />
              </div>
            )}
          </div>

          {/* Consumidor */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Consumidor</p>
            </div>

            {!pedido.consumidor_id ? (
              <p className="text-sm text-muted-foreground">Sem consumidor vinculado — pedido anônimo ou manual.</p>
            ) : loading ? (
              <p className="text-xs text-muted-foreground">Carregando…</p>
            ) : consumidor ? (
              <div className="grid grid-cols-1 gap-y-2.5">
                <InfoRow label="Nome" value={nomeConsumidor ?? "—"} />
                {telefone && <InfoRow label="Telefone" value={telefone} />}
                {email && <InfoRow label="E-mail" value={<span className="break-all">{email}</span>} />}
                {(consumidor.bairro || consumidor.cidade) && (
                  <InfoRow label="Localização" value={[consumidor.bairro, consumidor.cidade].filter(Boolean).join(", ")} />
                )}
                <div>
                  <p className="text-[11px] text-muted-foreground mb-0.5">Cadastro</p>
                  <Badge variant={consumidor.cadastro_completo ? "default" : "secondary"} className="text-[10px]">
                    {consumidor.cadastro_completo ? "Completo" : "Pendente"}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Consumidor não encontrado.</p>
            )}
          </div>
        </div>

        <Separator />

        {/* ── Cupons ── */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Cupons</p>
            <Badge variant={pedido.cupons_gerados > 0 ? "default" : "secondary"}>
              {pedido.cupons_gerados} cupom{pedido.cupons_gerados !== 1 ? "s" : ""}
            </Badge>
          </div>

          {/* Registros de cupom */}
          {cupons.length > 0 && (
            <div className="space-y-1">
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

          {/* Números da sorte */}
          {luckyNumbers.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Números da sorte</p>
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

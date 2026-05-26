import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PedidoConsumidor {
  id: string;
  data_pedido: string;
  pizzaria_nome: string;
  valor_total: number;
  taxa_entrega: number;
  desconto: number;
  canal: string;
  tipo_pedido: string;
  forma_pagamento: string;
  cupons_gerados: number;
  status: string;
}

export interface CupomHistorico {
  id: string;
  data_pedido: string;
  pizzaria_nome: string;
  valor_pedido: number;
  quantidade: number;
  acumulado: number;
}

export interface RankingItem {
  pos: number;
  consumidor_id: string;
  nome_display: string;
  total_cupons: number;
  e_voce: boolean;
}

interface ConsumidorDataContextValue {
  consumidorId: string | null;
  campanhaId: string | null;
  numSeries: number;
  cidade: string;
  bairro: string;
  aceitaWhatsapp: boolean;
  totalCupons: number;
  totalPedidos: number;
  totalGasto: number;
  ticketMedio: number;
  posicaoRanking: number | null;
  cuponsFaltamProxima: number;
  pedidos: PedidoConsumidor[];
  cupons: CupomHistorico[];
  ranking: RankingItem[];
  loading: boolean;
  refresh: () => void;
}

const ConsumidorDataContext = createContext<ConsumidorDataContextValue | undefined>(undefined);

export function ConsumidorDataProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [consumidorId, setConsumidorId] = useState<string | null>(null);
  const [campanhaId, setCampanhaId] = useState<string | null>(null);
  const [numSeries, setNumSeries] = useState(5);
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [aceitaWhatsapp, setAceitaWhatsapp] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoConsumidor[]>([]);
  const [cupons, setCupons] = useState<CupomHistorico[]>([]);
  const [ranking, setRanking] = useState<RankingItem[]>([]);

  const fetchAll = useCallback(async () => {
    if (!usuario?.id) { setLoading(false); return; }
    setLoading(true);

    const { data: cons } = await supabase
      .from("consumidores")
      .select("id, campanha_id, cidade, bairro, aceita_whatsapp")
      .eq("usuario_id", usuario.id)
      .single();

    if (!cons) { setLoading(false); return; }

    setConsumidorId(cons.id);
    setCampanhaId(cons.campanha_id);
    setCidade(cons.cidade ?? "");

    if (cons.campanha_id) {
      const { data: camp } = await supabase
        .from("campanhas")
        .select("num_series")
        .eq("id", cons.campanha_id)
        .single();
      setNumSeries(camp?.num_series ?? 5);
    }
    setBairro(cons.bairro ?? "");
    setAceitaWhatsapp(cons.aceita_whatsapp ?? false);

    const [pedidosRes, cuponsRes, rankingRes] = await Promise.allSettled([
      supabase
        .from("pedidos")
        .select("id, data_pedido, valor_total, taxa_entrega, desconto, canal, tipo_pedido, forma_pagamento, cupons_gerados, status, pizzarias(nome)")
        .eq("consumidor_id", cons.id)
        .order("data_pedido", { ascending: false }),

      supabase
        .from("cupons")
        .select("id, quantidade, pedidos(id, data_pedido, valor_total, pizzarias(nome))")
        .eq("consumidor_id", cons.id)
        .eq("status", "validado"),

      supabase.rpc("get_ranking_consumidores", { p_campanha_id: cons.campanha_id }),
    ]);

    if (pedidosRes.status === "fulfilled" && pedidosRes.value.data) {
      setPedidos(
        pedidosRes.value.data.map((p: any) => ({
          id: p.id,
          data_pedido: p.data_pedido,
          pizzaria_nome: (p.pizzarias as any)?.nome ?? "—",
          valor_total: p.valor_total,
          taxa_entrega: p.taxa_entrega ?? 0,
          desconto: p.desconto ?? 0,
          canal: p.canal ?? "",
          tipo_pedido: p.tipo_pedido ?? "",
          forma_pagamento: p.forma_pagamento ?? "",
          cupons_gerados: p.cupons_gerados ?? 0,
          status: p.status,
        })),
      );
    }

    if (cuponsRes.status === "fulfilled" && cuponsRes.value.data) {
      const sorted = [...cuponsRes.value.data].sort((a: any, b: any) =>
        new Date(b.pedidos?.data_pedido ?? 0).getTime() - new Date(a.pedidos?.data_pedido ?? 0).getTime(),
      );
      const total = sorted.reduce((s: number, c: any) => s + (c.quantidade ?? 0), 0);
      let acc = total;
      setCupons(
        sorted.map((c: any) => {
          const entry: CupomHistorico = {
            id: c.id,
            data_pedido: (c.pedidos as any)?.data_pedido ?? "",
            pizzaria_nome: (c.pedidos as any)?.pizzarias?.nome ?? "—",
            valor_pedido: (c.pedidos as any)?.valor_total ?? 0,
            quantidade: c.quantidade ?? 0,
            acumulado: acc,
          };
          acc -= c.quantidade ?? 0;
          return entry;
        }),
      );
    }

    if (rankingRes.status === "fulfilled" && rankingRes.value.data) {
      const raw = rankingRes.value.data as any[];
      setRanking(
        raw.map((r, idx) => ({
          pos: idx + 1,
          consumidor_id: r.consumidor_id,
          nome_display: r.nome_display,
          total_cupons: Number(r.total_cupons),
          e_voce: r.consumidor_id === cons.id,
        })),
      );
    }

    setLoading(false);
  }, [usuario?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totalCupons = useMemo(() => (cupons.length > 0 ? cupons[0].acumulado : 0), [cupons]);
  const pedidosEntregues = useMemo(() => pedidos.filter((p) => p.status === "entregue"), [pedidos]);
  const totalPedidos = pedidosEntregues.length;
  const totalGasto = useMemo(() => pedidosEntregues.reduce((s, p) => s + p.valor_total, 0), [pedidosEntregues]);
  const ticketMedio = totalPedidos > 0 ? totalGasto / totalPedidos : 0;

  const myRanking = useMemo(() => ranking.find((r) => r.e_voce), [ranking]);
  const posicaoRanking = myRanking?.pos ?? null;

  const cuponsFaltamProxima = useMemo(() => {
    if (!myRanking || myRanking.pos <= 1) return 0;
    const acima = ranking.find((r) => r.pos === myRanking.pos - 1);
    if (!acima) return 0;
    return Math.max(acima.total_cupons - myRanking.total_cupons + 1, 1);
  }, [myRanking, ranking]);

  return (
    <ConsumidorDataContext.Provider
      value={{
        consumidorId, campanhaId, numSeries, cidade, bairro, aceitaWhatsapp,
        totalCupons, totalPedidos, totalGasto, ticketMedio,
        posicaoRanking, cuponsFaltamProxima,
        pedidos, cupons, ranking,
        loading, refresh: fetchAll,
      }}
    >
      {children}
    </ConsumidorDataContext.Provider>
  );
}

export function useConsumidorData() {
  const ctx = useContext(ConsumidorDataContext);
  if (!ctx) throw new Error("useConsumidorData must be used within ConsumidorDataProvider");
  return ctx;
}

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ConsumidorPedido {
  id: string;
  data: Date;
  pizzariaId: string;
  pizzariaNome: string;
  valor: number;
  canalVenda: string;
  cuponsGerados: number;
}

export interface ConsumidorData {
  id: string;
  usuarioId: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  cidade: string;
  bairro: string;
  pizzariaVinculadaId: string;
  pizzariaVinculadaNome: string;
  status: "Ativo" | "Inativo";
  dataCadastro: Date;
  dataNascimento: Date | null;
  pedidos: ConsumidorPedido[];
  totalPedidos: number;
  totalGasto: number;
  ticketMedio: number;
  cuponsAcumulados: number;
  primeiroPedido: Date | null;
  ultimoPedido: Date | null;
}

export function useConsumidoresData() {
  const [data, setData] = useState<ConsumidorData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch consumidores with usuario and pizzaria info
      const { data: consumidores, error: cErr } = await supabase
        .from("consumidores")
        .select("*, usuarios(nome, cpf, email, telefone, ativo), pizzarias(id, nome)");

      if (cErr) {
        console.error("Error fetching consumidores:", cErr);
        setLoading(false);
        return;
      }

      if (!consumidores || consumidores.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      const consumidorIds = consumidores.map((c) => c.id);

      // Fetch pedidos for these consumidores
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("*, pizzarias(nome)")
        .in("consumidor_id", consumidorIds);

      // Fetch cupons for these consumidores
      const { data: cupons } = await supabase
        .from("cupons")
        .select("consumidor_id, quantidade")
        .in("consumidor_id", consumidorIds);

      // Build cupons map
      const cuponsMap = new Map<string, number>();
      cupons?.forEach((c) => {
        cuponsMap.set(c.consumidor_id, (cuponsMap.get(c.consumidor_id) ?? 0) + c.quantidade);
      });

      // Build pedidos map
      const pedidosMap = new Map<string, ConsumidorPedido[]>();
      pedidos?.forEach((p: any) => {
        const list = pedidosMap.get(p.consumidor_id) ?? [];
        list.push({
          id: p.id,
          data: new Date(p.data_pedido),
          pizzariaId: p.pizzaria_id,
          pizzariaNome: p.pizzarias?.nome ?? "",
          valor: Number(p.valor_total),
          canalVenda: p.canal,
          cuponsGerados: p.cupons_gerados,
        });
        pedidosMap.set(p.consumidor_id, list);
      });

      const mapped: ConsumidorData[] = consumidores.map((c: any) => {
        const cPedidos = (pedidosMap.get(c.id) ?? []).sort((a, b) => a.data.getTime() - b.data.getTime());
        const totalGasto = cPedidos.reduce((s, p) => s + p.valor, 0);
        const totalCupons = cuponsMap.get(c.id) ?? 0;

        return {
          id: c.id,
          usuarioId: c.usuario_id,
          nome: c.usuarios?.nome ?? "",
          cpf: c.usuarios?.cpf ?? "",
          email: c.usuarios?.email ?? "",
          telefone: c.usuarios?.telefone ?? "",
          cidade: c.cidade ?? "",
          bairro: c.bairro ?? "",
          pizzariaVinculadaId: c.pizzaria_id ?? "",
          pizzariaVinculadaNome: c.pizzarias?.nome ?? "",
          status: c.usuarios?.ativo !== false ? "Ativo" : "Inativo",
          dataCadastro: new Date(c.criado_em),
          dataNascimento: c.data_nascimento ? new Date(c.data_nascimento + "T00:00:00") : null,
          pedidos: cPedidos,
          totalPedidos: cPedidos.length,
          totalGasto,
          ticketMedio: cPedidos.length > 0 ? Math.round(totalGasto / cPedidos.length) : 0,
          cuponsAcumulados: totalCupons,
          primeiroPedido: cPedidos.length > 0 ? cPedidos[0].data : null,
          ultimoPedido: cPedidos.length > 0 ? cPedidos[cPedidos.length - 1].data : null,
        };
      });

      setData(mapped);
    } catch (err) {
      console.error("Error fetching consumidores data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, refetch: fetchData };
}

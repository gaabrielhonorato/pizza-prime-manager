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
  genero: string;
  dataNascimento: string;
  aceitaWhatsapp: boolean;
  cadastroCompleto: boolean;
  tags: string[];
  preCadastroOrigem: string;
  pizzariaVinculadaId: string;
  pizzariaVinculadaNome: string;
  status: "Ativo" | "Inativo";
  dataCadastro: Date;
  pedidos: ConsumidorPedido[];
  totalPedidos: number;
  totalGasto: number;
  ticketMedio: number;
  cuponsAcumulados: number;
  saldoAcumulado: number;
  faltaProximoCupom: number;
  primeiroPedido: Date | null;
  ultimoPedido: Date | null;
  diasDesdeUltimoPedido: number | null;
  intervaloMedio: number;
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

      // Busca campanha principal para filtrar pedidos e cupons pela campanha ativa
      const { data: campanha } = await supabase
        .from("campanhas")
        .select("id, valor_por_cupom")
        .eq("is_principal", true)
        .limit(1)
        .single();

      const campanhaId = campanha?.id;
      const valorPorCupom: number = campanha?.valor_por_cupom ?? 50;

      // Fetch pedidos for these consumidores (only from active campaign, exclude cancelled)
      const pedidosQuery = supabase
        .from("pedidos")
        .select("*, pizzarias(nome)")
        .in("consumidor_id", consumidorIds)
        .neq("status", "cancelado");
      const { data: pedidos } = campanhaId
        ? await pedidosQuery.eq("campanha_id", campanhaId)
        : await pedidosQuery;

      // Fetch cupons for these consumidores (validado or pendente only, active campaign)
      const cuponsQuery = supabase
        .from("cupons")
        .select("consumidor_id, quantidade, status")
        .in("consumidor_id", consumidorIds);
      const { data: cupons } = campanhaId
        ? await cuponsQuery.eq("campanha_id", campanhaId)
        : await cuponsQuery;

      // Build cupons map (only validado or pendente)
      const cuponsMap = new Map<string, number>();
      cupons?.forEach((c) => {
        if (c.status === "validado" || c.status === "pendente") {
          cuponsMap.set(c.consumidor_id, (cuponsMap.get(c.consumidor_id) ?? 0) + c.quantidade);
        }
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

      // Filter: only consumers with telefone
      const withPhone = consumidores.filter((c: any) => c.usuarios?.telefone);

      const now = new Date();

      const mapped: ConsumidorData[] = withPhone.map((c: any) => {
        const cPedidos = (pedidosMap.get(c.id) ?? []).sort((a, b) => a.data.getTime() - b.data.getTime());
        const totalGasto = cPedidos.reduce((s, p) => s + p.valor, 0);
        const totalCupons = cuponsMap.get(c.id) ?? 0;
        const saldoAcumulado = Math.round((totalGasto % valorPorCupom) * 100) / 100;
        const faltaProximoCupom = Math.round((valorPorCupom - saldoAcumulado) * 100) / 100;

        const ultimoPedido = cPedidos.length > 0 ? cPedidos[cPedidos.length - 1].data : null;
        const primeiroPedido = cPedidos.length > 0 ? cPedidos[0].data : null;

        const diasDesdeUltimoPedido = ultimoPedido
          ? Math.floor((now.getTime() - ultimoPedido.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        let intervaloMedio = 0;
        if (cPedidos.length >= 2) {
          let totalDiff = 0;
          for (let i = 1; i < cPedidos.length; i++) {
            totalDiff += (cPedidos[i].data.getTime() - cPedidos[i - 1].data.getTime()) / (1000 * 60 * 60 * 24);
          }
          intervaloMedio = Math.round(totalDiff / (cPedidos.length - 1));
        }

        return {
          id: c.id,
          usuarioId: c.usuario_id,
          nome: c.usuarios?.nome ?? "",
          cpf: c.usuarios?.cpf ?? "",
          email: c.usuarios?.email ?? "",
          telefone: c.usuarios?.telefone ?? "",
          cidade: c.cidade ?? "",
          bairro: c.bairro ?? "",
          genero: c.genero ?? "",
          dataNascimento: c.data_nascimento ?? "",
          aceitaWhatsapp: c.aceita_whatsapp !== false,
          cadastroCompleto: c.cadastro_completo !== false,
          tags: c.tags ?? [],
          preCadastroOrigem: c.pre_cadastro_origem ?? "",
          pizzariaVinculadaId: c.pizzaria_id ?? "",
          pizzariaVinculadaNome: c.pizzarias?.nome ?? "",
          status: c.usuarios?.ativo !== false ? "Ativo" : "Inativo",
          dataCadastro: new Date(c.criado_em),
          pedidos: cPedidos,
          totalPedidos: cPedidos.length,
          totalGasto,
          ticketMedio: cPedidos.length > 0 ? Math.round(totalGasto / cPedidos.length) : 0,
          cuponsAcumulados: totalCupons,
          saldoAcumulado,
          faltaProximoCupom,
          primeiroPedido,
          ultimoPedido,
          diasDesdeUltimoPedido,
          intervaloMedio,
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

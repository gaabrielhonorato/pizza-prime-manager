// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const CANAIS = [
  "cardapioweb","cardapioweb","cardapioweb","cardapioweb",
  "whatsapp","whatsapp","whatsapp",
  "balcao","balcao",
  "anuncios",
  "outros",
];
const PAGAMENTOS = [
  "pix","pix","pix","pix",
  "cartao_debito","cartao_debito","cartao_debito",
  "cartao_credito","cartao_credito",
  "dinheiro",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // Get campanha principal
    const { data: campanhas } = await supabase.rpc("get_campanha_principal");
    const campanhaId: string = campanhas?.[0]?.id;
    if (!campanhaId) return jsonResponse({ error: "Nenhuma campanha principal encontrada" }, 400);

    // First 10 active pizzarias
    const { data: pizzarias } = await supabase
      .from("pizzarias")
      .select("id")
      .eq("status", "ativa")
      .order("nome")
      .limit(10);
    if (!pizzarias?.length) return jsonResponse({ error: "Nenhuma pizzaria ativa" }, 400);

    // Existing consumidores
    const { data: consumidores } = await supabase
      .from("consumidores")
      .select("id")
      .limit(10);

    const pizzariaIds = pizzarias.map((p: any) => p.id);
    const consumidorIds = (consumidores ?? []).map((c: any) => c.id);

    const pedidoIds: string[] = [];
    const cupomIds: string[] = [];
    const repasseIds: string[] = [];

    const now = new Date();

    // 60 days of pedidos
    for (let daysAgo = 60; daysAgo >= 1; daysAgo--) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      const dow = date.getDay();
      const ordersToday = (dow === 0 || dow === 5 || dow === 6)
        ? 10 + Math.floor(Math.random() * 5)
        : 5 + Math.floor(Math.random() * 4);

      for (let i = 0; i < ordersToday; i++) {
        const pizzariaId = pick(pizzariaIds);
        const hasConsumidor = consumidorIds.length > 0 && Math.random() < 0.30;
        const consumidorId = hasConsumidor ? pick(consumidorIds) : null;

        const valor = 35 + Math.floor(Math.random() * 246);
        const canal = pick(CANAIS);
        const randStatus = Math.random();
        const status = randStatus < 0.80 ? "entregue" : randStatus < 0.90 ? "cancelado" : "recebido";
        const forma_pagamento = pick(PAGAMENTOS);

        const hora = 18 + Math.floor(Math.random() * 6);
        const minuto = Math.floor(Math.random() * 60);
        const dataPedido = new Date(date);
        dataPedido.setHours(hora, minuto, 0, 0);

        const cuponsGerados = status === "entregue" && consumidorId
          ? Math.max(Math.floor(valor / 50), 1)
          : 0;

        const pedidoId = crypto.randomUUID();
        const { error: pe } = await supabase.from("pedidos").insert({
          id: pedidoId,
          campanha_id: campanhaId,
          pizzaria_id: pizzariaId,
          consumidor_id: consumidorId,
          valor_total: valor,
          canal,
          status,
          forma_pagamento,
          cupons_gerados: cuponsGerados,
          data_pedido: dataPedido.toISOString(),
        });
        if (pe) throw pe;
        pedidoIds.push(pedidoId);

        if (cuponsGerados > 0 && consumidorId) {
          const cupomId = crypto.randomUUID();
          await supabase.from("cupons").insert({
            id: cupomId,
            campanha_id: campanhaId,
            consumidor_id: consumidorId,
            pedido_id: pedidoId,
            quantidade: cuponsGerados,
            status: "validado",
          });
          cupomIds.push(cupomId);
        }
      }
    }

    // Repasses: 2 months × each pizzaria
    for (const pizzariaId of pizzariaIds) {
      for (let monthsAgo = 2; monthsAgo >= 1; monthsAgo--) {
        const mesInicio = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
        const mesFim = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
        const proximoMes = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1);

        const { data: pedidosMes } = await supabase
          .from("pedidos")
          .select("valor_total")
          .eq("pizzaria_id", pizzariaId)
          .eq("status", "entregue")
          .gte("data_pedido", mesInicio.toISOString())
          .lt("data_pedido", proximoMes.toISOString());

        const valorBruto = (pedidosMes ?? []).reduce((s: number, p: any) => s + Number(p.valor_total), 0);
        if (valorBruto > 0) {
          const repasseId = crypto.randomUUID();
          await supabase.from("repasses").insert({
            id: repasseId,
            campanha_id: campanhaId,
            pizzaria_id: pizzariaId,
            periodo_inicio: mesInicio.toISOString().slice(0, 10),
            periodo_fim: mesFim.toISOString().slice(0, 10),
            valor_bruto: valorBruto,
            percentual_pizza_premiada: 15,
            valor_pizza_premiada: valorBruto * 0.15,
            valor_repasse: valorBruto * 0.85,
            status: "pendente",
          });
          repasseIds.push(repasseId);
        }
      }
    }

    // Append IDs to integracoes tracking record
    const { data: existing } = await supabase
      .from("integracoes")
      .select("config")
      .eq("nome", "seed_test_data")
      .maybeSingle();

    const prev = existing?.config as any ?? {};
    await supabase.from("integracoes").upsert({
      nome: "seed_test_data",
      provedor: "interno",
      status: "configured",
      config: {
        pedido_ids: [...(prev.pedido_ids ?? []), ...pedidoIds],
        cupom_ids: [...(prev.cupom_ids ?? []), ...cupomIds],
        repasse_ids: [...(prev.repasse_ids ?? []), ...repasseIds],
        gerado_em: new Date().toISOString(),
      },
      atualizado_em: new Date().toISOString(),
    }, { onConflict: "nome" });

    return jsonResponse({ success: true, pedidos: pedidoIds.length, cupons: cupomIds.length, repasses: repasseIds.length });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, 500);
  }
});

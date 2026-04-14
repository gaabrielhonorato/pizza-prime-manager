import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORDER_TYPE_MAP: Record<string, string> = {
  delivery: "delivery",
  takeout: "retirada",
  take_out: "retirada",
  pickup: "retirada",
  dine_in: "local",
  closed_table: "local",
  indoor: "local",
};

const PAYMENT_METHOD_MAP: Record<string, string> = {
  credit_card: "cartao_credito",
  debit_card: "cartao_debito",
  pix: "pix",
  cash: "dinheiro",
  meal_voucher: "vale_refeicao",
  food_voucher: "vale_alimentacao",
  online: "online",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get all pedidos missing tipo_pedido
  const { data: pedidos, error } = await supabase
    .from("pedidos")
    .select("id, cardapioweb_order_id, pizzaria_id")
    .not("cardapioweb_order_id", "is", null)
    .is("tipo_pedido", null);

  if (error || !pedidos) {
    return new Response(JSON.stringify({ error: error?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get pizzaria API keys
  const pizzariaIds = [...new Set(pedidos.map(p => p.pizzaria_id))];
  const { data: pizzarias } = await supabase
    .from("pizzarias")
    .select("id, cardapioweb_api_key")
    .in("id", pizzariaIds);

  const keyMap = new Map((pizzarias ?? []).map(p => [p.id, p.cardapioweb_api_key]));

  let updated = 0;
  let failed = 0;
  const results: any[] = [];

  for (const pedido of pedidos) {
    const apiKey = keyMap.get(pedido.pizzaria_id);
    if (!apiKey) { failed++; continue; }

    try {
      const res = await fetch(
        `https://integracao.cardapioweb.com/api/partner/v1/orders/${pedido.cardapioweb_order_id}`,
        { headers: { "X-API-KEY": apiKey, "Accept": "application/json" } }
      );
      if (!res.ok) { failed++; continue; }

      const cw = await res.json();

      const rawType = String(cw.order_type ?? "").toLowerCase();
      const tipoPedido = ORDER_TYPE_MAP[rawType] ?? "delivery";

      const payments = Array.isArray(cw.payments) ? cw.payments : [];
      const rawPM = String(payments[0]?.payment_method ?? "").toLowerCase();
      const formaPagamento = PAYMENT_METHOD_MAP[rawPM] ?? (rawPM || null);

      const addr = cw.delivery_address ?? {};
      const bairro = String(addr.neighborhood ?? addr.bairro ?? "").trim() || null;
      const taxaEntrega = Number(cw.delivery_fee ?? 0);
      const desconto = Array.isArray(cw.discounts)
        ? cw.discounts.reduce((s: number, d: any) => s + Number(d.amount ?? d.value ?? 0), 0)
        : 0;

      const { error: upErr } = await supabase
        .from("pedidos")
        .update({
          tipo_pedido: tipoPedido,
          forma_pagamento: formaPagamento,
          bairro_entrega: bairro,
          taxa_entrega: taxaEntrega,
          desconto,
          horario_pedido: cw.created_at ?? null,
        })
        .eq("id", pedido.id);

      if (upErr) { failed++; } else {
        updated++;
        results.push({ id: pedido.id, tipo: tipoPedido, pagamento: formaPagamento });
      }

      // Rate limit: 200ms between calls
      await new Promise(r => setTimeout(r, 200));
    } catch {
      failed++;
    }
  }

  return new Response(JSON.stringify({ total: pedidos.length, updated, failed, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

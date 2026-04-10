import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // === DIAGNOSTIC LOGGING ===
    console.log("[WEBHOOK] Method:", req.method);
    console.log("[WEBHOOK] URL:", req.url);
    console.log("[WEBHOOK] Query params:", JSON.stringify(Object.fromEntries(new URL(req.url).searchParams)));
    console.log("[WEBHOOK] Headers:", JSON.stringify(Object.fromEntries(req.headers.entries())));

    const rawBody = await req.text();
    console.log("[WEBHOOK] Raw body:", rawBody);

    let body: any = {};
    try {
      body = JSON.parse(rawBody);
      console.log("[WEBHOOK] Parsed body:", JSON.stringify(body, null, 2));
    } catch (e) {
      console.error("[WEBHOOK] Falha ao parsear JSON:", String(e));
    }
    // === END DIAGNOSTIC LOGGING ===

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);

    // Get merchant_id from body or query param
    const merchantId = body.merchant_id || url.searchParams.get("merchant_id");
    const pizzariaIdParam = url.searchParams.get("pid");

    if (!merchantId && !pizzariaIdParam) {
      console.error("[WEBHOOK] Rejeitado — motivo: merchant_id e pid ausentes. Body:", JSON.stringify(body));
      return new Response(JSON.stringify({ error: "merchant_id ou pid é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the pizzaria by merchant_id or direct pid
    let pizzaria: any = null;

    if (pizzariaIdParam) {
      const { data } = await supabaseAdmin
        .from("pizzarias")
        .select("id, cardapioweb_merchant_id, cardapioweb_api_key")
        .eq("id", pizzariaIdParam)
        .single();
      pizzaria = data;
    } else if (merchantId) {
      const { data } = await supabaseAdmin
        .from("pizzarias")
        .select("id, cardapioweb_merchant_id, cardapioweb_api_key")
        .eq("cardapioweb_merchant_id", merchantId)
        .single();
      pizzaria = data;
    }

    if (!pizzaria) {
      console.error("[WEBHOOK] Rejeitado — motivo: pizzaria não encontrada. merchant_id:", merchantId, "pid:", pizzariaIdParam);
      return new Response(JSON.stringify({ error: "Pizzaria não encontrada para o merchant_id informado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active campaign
    const { data: campanha } = await supabaseAdmin
      .from("campanhas")
      .select("id, valor_por_cupom, cupons_por_valor, valor_minimo_pedido, arredondamento, bonus_aniversario_ativo, bonus_aniversario_multiplicador, bonus_aniversario_tipo_pedido")
      .eq("is_principal", true)
      .limit(1)
      .single();

    if (!campanha) {
      console.error("[WEBHOOK] Rejeitado — motivo: nenhuma campanha ativa (is_principal=true)");
      return new Response(JSON.stringify({ error: "Nenhuma campanha ativa" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract order data from webhook payload
    const valorTotal = Number(body.valor_total || body.total || 0);
    const canal = body.canal || "cardapioweb";
    const telefoneCliente = body.telefone || body.customer_phone || null;
    const tipoPedido = body.tipo_pedido || null;

    if (valorTotal <= 0) {
      console.error("[WEBHOOK] Rejeitado — motivo: valor_total inválido. valor_total:", body.valor_total, "total:", body.total, "calculado:", valorTotal);
      return new Response(JSON.stringify({ error: "valor_total inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate coupons using the DB function
    const { data: cuponsQtd } = await supabaseAdmin.rpc("calcular_cupons", {
      _valor_pedido: valorTotal,
      _pizzaria_id: pizzaria.id,
    });

    const cuponsGerados = cuponsQtd ?? 0;

    // Find or create consumidor by phone if provided
    let consumidorId: string | null = null;
    if (telefoneCliente) {
      const { data: usuario } = await supabaseAdmin
        .from("usuarios")
        .select("id")
        .eq("telefone", telefoneCliente)
        .limit(1)
        .maybeSingle();

      if (usuario) {
        const { data: consumidor } = await supabaseAdmin
          .from("consumidores")
          .select("id")
          .eq("usuario_id", usuario.id)
          .limit(1)
          .maybeSingle();
        consumidorId = consumidor?.id ?? null;
      }
    }

    // Create pedido
    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from("pedidos")
      .insert({
        pizzaria_id: pizzaria.id,
        campanha_id: campanha.id,
        valor_total: valorTotal,
        canal,
        cupons_gerados: cuponsGerados,
        consumidor_id: consumidorId,
        status: "recebido",
        tipo_pedido: tipoPedido,
      })
      .select("id")
      .single();

    if (pedidoError) {
      console.error("[WEBHOOK] Error creating pedido:", pedidoError);
      return new Response(JSON.stringify({ error: pedidoError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create cupons if consumidor exists and cupons > 0
    let cuponsFinais = cuponsGerados;
    let cuponsBonus = 0;

    if (consumidorId && cuponsGerados > 0 && campanha.bonus_aniversario_ativo) {
      const { data: consData } = await supabaseAdmin
        .from("consumidores")
        .select("data_nascimento")
        .eq("id", consumidorId)
        .single();

      if (consData?.data_nascimento) {
        const birthMonth = new Date(consData.data_nascimento).getUTCMonth();
        const currentMonth = new Date().getMonth();
        const tipoPedidoOk = !campanha.bonus_aniversario_tipo_pedido || campanha.bonus_aniversario_tipo_pedido === tipoPedido;

        if (birthMonth === currentMonth && tipoPedidoOk) {
          const mult = Number(campanha.bonus_aniversario_multiplicador) || 2;
          const cuponsMultiplicados = Math.ceil(cuponsGerados * mult);
          cuponsBonus = cuponsMultiplicados - cuponsGerados;
          cuponsFinais = cuponsMultiplicados;
        }
      }
    }

    if (consumidorId && cuponsFinais > 0) {
      await supabaseAdmin.from("cupons").insert({
        campanha_id: campanha.id,
        consumidor_id: consumidorId,
        pedido_id: pedido.id,
        quantidade: cuponsGerados,
        status: "pendente",
      });

      if (cuponsBonus > 0) {
        await supabaseAdmin.from("cupons_bonus").insert({
          campanha_id: campanha.id,
          consumidor_id: consumidorId,
          tipo: "aniversario",
          quantidade: cuponsBonus,
          motivo: "Bônus de aniversário",
          status: "validado",
        });
      }
    }

    console.log("[WEBHOOK] Sucesso — pedido_id:", pedido.id, "cupons:", cuponsGerados, "pizzaria:", pizzaria.id);

    return new Response(
      JSON.stringify({
        success: true,
        pedido_id: pedido.id,
        cupons_gerados: cuponsGerados,
        pizzaria_id: pizzaria.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[WEBHOOK] Erro interno:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

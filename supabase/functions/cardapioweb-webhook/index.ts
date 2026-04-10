import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RELEVANT_EVENTS = [
  "ORDER_CREATED",
  "ORDER_STATUS_UPDATED",
  "ORDER_DELIVERED",
];

const STATUS_MAP: Record<string, string> = {
  waiting_confirmation: "em_preparo",
  waiting_to_catch: "em_preparo",
  preparing: "em_preparo",
  delivery: "saiu_entrega",
  on_the_way: "saiu_entrega",
  delivered: "entregue",
  entregue: "entregue",
};

const CANCELLED_STATUSES = ["cancelled", "canceled", "cancelado"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // === STEP 0: Diagnostic logging ===
    console.log("[WEBHOOK] Method:", req.method);
    console.log("[WEBHOOK] URL:", req.url);

    const rawBody = await req.text();
    console.log("[WEBHOOK] Raw body:", rawBody);

    let body: any = {};
    try {
      body = JSON.parse(rawBody);
      console.log("[WEBHOOK] Parsed body:", JSON.stringify(body, null, 2));
    } catch (e) {
      console.error("[WEBHOOK] Falha ao parsear JSON:", String(e));
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === STEP 1: Validate payload ===
    const merchantId = body.merchant_id != null ? String(body.merchant_id) : null;
    const orderId = body.order_id != null ? String(body.order_id) : null;
    const eventType = body.event_type ?? null;
    const eventId = body.event_id ?? null;

    console.log("[WEBHOOK] event_id:", eventId, "event_type:", eventType, "merchant_id:", merchantId, "order_id:", orderId);

    if (!merchantId || !orderId) {
      console.error("[WEBHOOK] Rejeitado — merchant_id ou order_id ausente");
      return new Response(JSON.stringify({ error: "merchant_id e order_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (eventType && !RELEVANT_EVENTS.includes(eventType)) {
      console.log("[WEBHOOK] Evento ignorado:", eventType);
      return new Response(JSON.stringify({ ok: true, message: "evento ignorado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === STEP 2: Locate pizzaria ===
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: pizzaria, error: pizzariaErr } = await supabaseAdmin
      .from("pizzarias")
      .select("id, cardapioweb_merchant_id, cardapioweb_api_key, status")
      .eq("cardapioweb_merchant_id", merchantId)
      .single();

    if (pizzariaErr || !pizzaria) {
      console.error("[WEBHOOK] Pizzaria não encontrada para merchant_id:", merchantId, pizzariaErr?.message);
      return new Response(JSON.stringify({ error: "Pizzaria não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pizzaria.status !== "ativa") {
      console.log("[WEBHOOK] Pizzaria inativa:", pizzaria.id, "status:", pizzaria.status);
      return new Response(JSON.stringify({ ok: true, message: "pizzaria inativa, ignorado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = pizzaria.cardapioweb_api_key;
    if (!apiKey) {
      console.error("[WEBHOOK] Pizzaria sem cardapioweb_api_key:", pizzaria.id);
      return new Response(JSON.stringify({ error: "Pizzaria sem API key configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === STEP 3: Fetch order details from CardápioWeb API ===
    const cwUrl = `https://integracao.cardapioweb.com/api/partner/v1/orders/${orderId}`;
    console.log("[CW] Fetching:", cwUrl);

    const cwRes = await fetch(cwUrl, {
      method: "GET",
      headers: {
        "X-API-KEY": apiKey,
        "Accept": "application/json",
      },
    });

    const cwBodyRaw = await cwRes.text();
    console.log("[CW] Status:", cwRes.status);
    console.log("[CW] Body raw:", cwBodyRaw);

    if (!cwRes.ok) {
      console.error("[CW] Erro ao buscar pedido. Status:", cwRes.status);
      return new Response(JSON.stringify({ error: "Erro ao buscar detalhes do pedido no CardápioWeb" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let cwOrder: any;
    try {
      cwOrder = JSON.parse(cwBodyRaw);
    } catch {
      console.error("[CW] Resposta não é JSON válido");
      return new Response(JSON.stringify({ error: "Resposta do CardápioWeb não é JSON" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[CW] cwOrder completo:", JSON.stringify(cwOrder, null, 2));

    // === STEP 4: Extract order data with fallbacks ===
    const valorTotal = Number(
      cwOrder.total ?? cwOrder.valor_total ?? cwOrder.amount ??
      cwOrder.totalAmount ?? cwOrder.order_total ?? cwOrder.subtotal ?? 0
    );

    const customer = (cwOrder.customer ?? cwOrder.cliente ?? {}) as Record<string, unknown>;

    const telefone = String(
      customer.phone ?? customer.telefone ?? customer.cellphone ??
      cwOrder.phone ?? cwOrder.cellphone ?? ""
    ).replace(/\D/g, "") || null;

    const nome = String(customer.name ?? customer.nome ?? "").trim() || null;

    console.log("[CW] Extracted → valor:", valorTotal, "telefone:", telefone, "nome:", nome);

    // === STEP 5: Map order status ===
    const orderStatus = body.order_status ?? cwOrder.status ?? cwOrder.order_status ?? "";

    if (CANCELLED_STATUSES.includes(orderStatus.toLowerCase())) {
      console.log("[WEBHOOK] Pedido cancelado, ignorando:", orderId);
      return new Response(JSON.stringify({ ok: true, message: "pedido cancelado, ignorado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statusMapped = STATUS_MAP[orderStatus] ?? "em_preparo";

    // === STEP 6: Campaign & minimum value ===
    const { data: campanha } = await supabaseAdmin
      .from("campanhas")
      .select("id, valor_por_cupom, cupons_por_valor, valor_minimo_pedido, arredondamento, bonus_aniversario_ativo, bonus_aniversario_multiplicador, bonus_aniversario_tipo_pedido, percentual_comissao")
      .eq("is_principal", true)
      .limit(1)
      .single();

    if (!campanha) {
      console.error("[WEBHOOK] Nenhuma campanha ativa (is_principal=true)");
      return new Response(JSON.stringify({ error: "Nenhuma campanha ativa" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (valorTotal <= 0) {
      console.error("[WEBHOOK] Valor total inválido após extração:", valorTotal);
      return new Response(JSON.stringify({ ok: true, message: "valor total inválido, ignorado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (valorTotal < campanha.valor_minimo_pedido) {
      console.log("[WEBHOOK] Abaixo do valor mínimo:", valorTotal, "<", campanha.valor_minimo_pedido);
      return new Response(JSON.stringify({ ok: true, message: "abaixo do valor mínimo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === STEP 7: Resolve consumer by phone ===
    let consumidorId: string | null = null;
    if (telefone) {
      const { data: usuario } = await supabaseAdmin
        .from("usuarios")
        .select("id")
        .eq("telefone", telefone)
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

    // === STEP 8 + 9: Upsert order (dedup by cardapioweb_order_id) ===
    const cwOrderIdStr = orderId;

    // Check for existing order
    const { data: existingOrder } = await supabaseAdmin
      .from("pedidos")
      .select("id, status")
      .eq("cardapioweb_order_id", cwOrderIdStr)
      .maybeSingle();

    // Calculate coupons
    const { data: cuponsQtd } = await supabaseAdmin.rpc("calcular_cupons", {
      _valor_pedido: valorTotal,
      _pizzaria_id: pizzaria.id,
    });
    const cuponsGerados = cuponsQtd ?? 0;

    let pedidoId: string;

    if (existingOrder) {
      // UPDATE existing order status
      console.log("[WEBHOOK] Pedido já existe, atualizando status:", existingOrder.id, "→", statusMapped);
      const { error: updateErr } = await supabaseAdmin
        .from("pedidos")
        .update({ status: statusMapped })
        .eq("id", existingOrder.id);

      if (updateErr) {
        console.error("[WEBHOOK] Erro ao atualizar pedido:", updateErr.message);
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pedidoId = existingOrder.id;
    } else {
      // INSERT new order
      const pedidoData = {
        pizzaria_id: pizzaria.id,
        campanha_id: campanha.id,
        valor_total: valorTotal,
        canal: "cardapioweb",
        cupons_gerados: cuponsGerados,
        consumidor_id: consumidorId,
        status: statusMapped,
        cardapioweb_order_id: cwOrderIdStr,
      };

      console.log("[WEBHOOK] Inserindo pedido:", JSON.stringify(pedidoData));

      const { data: pedido, error: pedidoError } = await supabaseAdmin
        .from("pedidos")
        .insert(pedidoData)
        .select("id")
        .single();

      if (pedidoError) {
        console.error("[WEBHOOK] Erro ao criar pedido:", pedidoError.message);
        return new Response(JSON.stringify({ error: pedidoError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      pedidoId = pedido.id;

      // Generate coupons for new orders only
      if (consumidorId && cuponsGerados > 0) {
        let cuponsFinais = cuponsGerados;
        let cuponsBonus = 0;

        if (campanha.bonus_aniversario_ativo) {
          const { data: consData } = await supabaseAdmin
            .from("consumidores")
            .select("data_nascimento")
            .eq("id", consumidorId)
            .single();

          if (consData?.data_nascimento) {
            const birthMonth = new Date(consData.data_nascimento).getUTCMonth();
            const currentMonth = new Date().getMonth();
            if (birthMonth === currentMonth) {
              const mult = Number(campanha.bonus_aniversario_multiplicador) || 2;
              const cuponsMultiplicados = Math.ceil(cuponsGerados * mult);
              cuponsBonus = cuponsMultiplicados - cuponsGerados;
              cuponsFinais = cuponsMultiplicados;
            }
          }
        }

        await supabaseAdmin.from("cupons").insert({
          campanha_id: campanha.id,
          consumidor_id: consumidorId,
          pedido_id: pedidoId,
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

        console.log("[WEBHOOK] Cupons gerados:", cuponsGerados, "bonus:", cuponsBonus);
      }
    }

    console.log("[WEBHOOK] Sucesso — pedido_id:", pedidoId, "cupons:", cuponsGerados, "ação:", existingOrder ? "atualizado" : "criado");

    return new Response(
      JSON.stringify({
        success: true,
        pedido_id: pedidoId,
        cupons_gerados: existingOrder ? 0 : cuponsGerados,
        pizzaria_id: pizzaria.id,
        action: existingOrder ? "updated" : "created",
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

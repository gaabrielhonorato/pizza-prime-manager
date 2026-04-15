import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORDER_TYPE_MAP: Record<string, string> = {
  delivery: "delivery",
  takeout: "retirada",
  take_out: "retirada",
  dine_in: "local",
  closed_table: "local",
};

const PAYMENT_MAP: Record<string, string> = {
  credit_card: "cartao_credito",
  debit_card: "cartao_debito",
  money: "dinheiro",
  cash: "dinheiro",
  pix: "pix",
  voucher: "voucher",
  online: "online",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all pizzarias with CardápioWeb integration
    const { data: pizzarias } = await supabase
      .from("pizzarias")
      .select("id, nome, cardapioweb_merchant_id, cardapioweb_api_key")
      .eq("status", "ativa")
      .not("cardapioweb_merchant_id", "is", null)
      .not("cardapioweb_api_key", "is", null);

    if (!pizzarias || pizzarias.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma pizzaria com integração CardápioWeb ativa." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get principal campaign
    const { data: campanha } = await supabase
      .from("campanhas")
      .select("id, valor_por_cupom, valor_minimo_pedido")
      .eq("is_principal", true)
      .limit(1)
      .single();

    if (!campanha) {
      return new Response(JSON.stringify({ error: "Nenhuma campanha principal encontrada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalNovos = 0;
    let totalExistentes = 0;
    const errors: string[] = [];

    for (const pizzaria of pizzarias) {
      try {
        // Fetch today's orders from CardápioWeb
        const today = new Date().toISOString().slice(0, 10);
        const apiUrl = `https://integracao.cardapioweb.com/api/partner/v1/orders?merchant_id=${pizzaria.cardapioweb_merchant_id}&date=${today}`;

        const response = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${pizzaria.cardapioweb_api_key}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          errors.push(`${pizzaria.nome}: API retornou ${response.status}`);
          continue;
        }

        const data = await response.json();
        const orders = Array.isArray(data) ? data : data.orders ?? [];

        for (const order of orders) {
          const orderId = String(order.id || order.order_id);

          // Check if already exists
          const { data: existing } = await supabase
            .from("pedidos")
            .select("id")
            .eq("cardapioweb_order_id", orderId)
            .maybeSingle();

          if (existing) {
            totalExistentes++;
            continue;
          }

          // Extract customer phone
          const phone = order.customer?.phone || order.customer?.cellphone;
          if (!phone) {
            continue; // Skip orders without phone
          }

          const cleanPhone = phone.replace(/\D/g, "");
          const orderType = ORDER_TYPE_MAP[order.order_type || order.type || ""] || "delivery";
          const paymentMethod = PAYMENT_MAP[order.payments?.[0]?.method || order.payment_method || ""] || null;

          // Find or create consumer
          const { data: usuario } = await supabase
            .from("usuarios")
            .select("id")
            .eq("telefone", cleanPhone)
            .maybeSingle();

          let consumidorId: string | null = null;

          if (usuario) {
            const { data: cons } = await supabase
              .from("consumidores")
              .select("id")
              .eq("usuario_id", usuario.id)
              .maybeSingle();
            consumidorId = cons?.id || null;
          }

          if (!consumidorId) {
            // Create shadow user + consumer
            const { data: newUser } = await supabase
              .from("usuarios")
              .insert({
                id: crypto.randomUUID(),
                nome: order.customer?.name || "",
                email: `${cleanPhone}@placeholder.pizzapremiada.com`,
                telefone: cleanPhone,
                perfil: "consumidor",
              })
              .select("id")
              .single();

            if (newUser) {
              const { data: newCons } = await supabase
                .from("consumidores")
                .insert({
                  usuario_id: newUser.id,
                  pizzaria_id: pizzaria.id,
                  campanha_id: campanha.id,
                  cadastro_completo: false,
                })
                .select("id")
                .single();
              consumidorId = newCons?.id || null;
            }
          }

          // Calculate cupons
          const valorTotal = Number(order.total || 0);
          const { data: cuponsCalc } = await supabase.rpc("calcular_cupons", {
            _valor_pedido: valorTotal,
            _pizzaria_id: pizzaria.id,
          });
          const cuponsGerados = cuponsCalc ?? 0;

          // Insert order
          const { data: newPedido } = await supabase
            .from("pedidos")
            .insert({
              pizzaria_id: pizzaria.id,
              campanha_id: campanha.id,
              consumidor_id: consumidorId,
              cardapioweb_order_id: orderId,
              valor_total: valorTotal,
              canal: "cardapioweb",
              status: "entregue",
              cupons_gerados: cuponsGerados,
              tipo_pedido: orderType,
              forma_pagamento: paymentMethod,
              bairro_entrega: order.delivery_address?.neighborhood || null,
              taxa_entrega: Number(order.delivery_fee || 0),
              desconto: Number(order.discount || order.discounts || 0),
              horario_pedido: order.created_at ? new Date(order.created_at).toISOString() : null,
            })
            .select("id")
            .single();

          // Create cupons
          if (newPedido && consumidorId && cuponsGerados > 0) {
            const cadastroCompleto = !!usuario;
            await supabase.from("cupons").insert({
              campanha_id: campanha.id,
              consumidor_id: consumidorId,
              pedido_id: newPedido.id,
              quantidade: cuponsGerados,
              status: cadastroCompleto ? "validado" : "pendente",
            });
          }

          totalNovos++;
        }
      } catch (err: any) {
        errors.push(`${pizzaria.nome}: ${err.message}`);
      }
    }

    // Log result
    const msg = `Sync concluído: ${totalNovos} pedidos novos, ${totalExistentes} já existiam.`;
    await supabase.from("logs_sistema").insert({
      tipo: "sync_pedidos",
      mensagem: msg,
      detalhes: { novos: totalNovos, existentes: totalExistentes, errors },
      status: errors.length > 0 ? "parcial" : "sucesso",
    });

    return new Response(JSON.stringify({
      success: true,
      novos: totalNovos,
      existentes: totalExistentes,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

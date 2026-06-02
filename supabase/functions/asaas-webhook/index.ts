import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAID_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);

Deno.serve(async (req) => {
  try {
    // ── Validar token enviado pelo Asaas no header ──────────────
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    if (expectedToken) {
      const receivedToken = req.headers.get("asaas-access-token");
      if (receivedToken !== expectedToken) {
        console.warn("[asaas-webhook] Token inválido — requisição rejeitada");
        return new Response("unauthorized", { status: 401 });
      }
    }

    const body = await req.json() as { event: string; payment: Record<string, any> };
    const { event, payment } = body;

    console.log(`[asaas-webhook] event=${event} paymentId=${payment?.id} ref=${payment?.externalReference}`);

    if (!PAID_EVENTS.has(event)) {
      return new Response("ignored", { status: 200 });
    }

    const cobrancaId: string | undefined = payment?.externalReference;
    if (!cobrancaId) {
      console.log("[asaas-webhook] Sem externalReference — ignorando");
      return new Response("ok", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await supabase
      .from("cobrancas_repasse")
      .update({
        status:         "pago",
        data_pagamento: payment.paymentDate ?? new Date().toISOString().slice(0, 10),
        observacao:     `Pago via Asaas (${event}). ID: ${payment.id}`,
      })
      .eq("id", cobrancaId)
      .neq("status", "pago"); // idempotente

    if (error) {
      console.error("[asaas-webhook] Erro no banco:", error);
      return new Response("db error", { status: 500 });
    }

    console.log(`[asaas-webhook] Cobrança ${cobrancaId} marcada como PAGA`);
    return new Response("ok", { status: 200 });

  } catch (err) {
    console.error("[asaas-webhook] Erro inesperado:", err);
    return new Response("error", { status: 500 });
  }
});

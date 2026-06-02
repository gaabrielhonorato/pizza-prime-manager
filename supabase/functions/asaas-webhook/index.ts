import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Asaas payment events that indicate the boleto was paid
const PAID_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);

// Asaas payment events that indicate the boleto is overdue / cancelled
const OVERDUE_EVENTS = new Set(["PAYMENT_OVERDUE"]);

Deno.serve(async (req) => {
  // Asaas sends POST with JSON body; no HMAC signature by default.
  // You can optionally add a ?token= query param and validate here.
  try {
    const body = await req.json() as { event: string; payment: Record<string, any> };
    const { event, payment } = body;

    console.log(`[asaas-webhook] event=${event} paymentId=${payment?.id} ref=${payment?.externalReference}`);

    if (!PAID_EVENTS.has(event) && !OVERDUE_EVENTS.has(event)) {
      return new Response("ignored", { status: 200 });
    }

    const cobrancaId: string | undefined = payment?.externalReference;
    if (!cobrancaId) {
      console.log("[asaas-webhook] No externalReference — skipping");
      return new Response("ok", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (PAID_EVENTS.has(event)) {
      const { error } = await supabase
        .from("cobrancas_repasse")
        .update({
          status:         "pago",
          data_pagamento: payment.paymentDate ?? new Date().toISOString().slice(0, 10),
          observacao:     `Pago via Asaas (${event}). ID pagamento: ${payment.id}`,
        })
        .eq("id", cobrancaId)
        .neq("status", "pago"); // idempotente — não sobrescreve se já marcado

      if (error) {
        console.error("[asaas-webhook] DB update error:", error);
        return new Response("db error", { status: 500 });
      }

      console.log(`[asaas-webhook] Cobrança ${cobrancaId} marcada como PAGA`);
    }

    return new Response("ok", { status: 200 });

  } catch (err) {
    console.error("[asaas-webhook] Unexpected error:", err);
    return new Response("error", { status: 500 });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const event = body?.event as string;
    const data  = body?.data;

    console.log("[spedy-webhook] event:", event, "invoice_id:", data?.id, "status:", data?.status);

    // Ignora eventos que não são de nota fiscal ou sem transactionId
    if (!event?.startsWith("invoice.") || !data?.order?.transactionId) {
      return new Response(JSON.stringify({ ok: true, message: "ignorado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cobranca_id   = data.order.transactionId as string;
    const invoiceId     = data.id as string;
    const invoiceStatus = data.status as string;
    const nfseNumber    = data.number ?? null;
    const pdfUrl: string | null =
      data.pdfUrl ?? data.downloadUrl ?? data.pdf ??
      data.nfsePdf ?? data.linkDownloadNFSe ?? null;
    const errorMsg: string | null =
      data.processingDetail?.message ?? data.errorMessage ?? null;

    const STATUS_MAP: Record<string, string> = {
      authorized: "authorized",
      rejected:   "rejected",
      canceled:   "canceled",
      enqueued:   "pending",
      processing: "pending",
    };
    const mappedStatus = STATUS_MAP[invoiceStatus] ?? "pending";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { error } = await admin
      .from("cobrancas_repasse")
      .update({
        spedy_invoice_id:     invoiceId,
        spedy_invoice_status: mappedStatus,
        spedy_nfse_number:    nfseNumber,
        spedy_nfse_pdf_url:   pdfUrl,
        spedy_invoice_error:  mappedStatus === "rejected" ? errorMsg : null,
      })
      .eq("id", cobranca_id);

    if (error) {
      console.error("[spedy-webhook] erro ao atualizar cobrança:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[spedy-webhook] cobrança atualizada:", cobranca_id, "→", mappedStatus, "nfse:", nfseNumber);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[spedy-webhook] erro interno:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

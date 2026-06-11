import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPEDY_BASE_URL = Deno.env.get("SPEDY_BASE_URL") ?? "https://sandbox-api.spedy.com.br/v1";
const SPEDY_API_KEY  = Deno.env.get("SPEDY_API_KEY")  ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const reply = (data: object, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { cobranca_id } = await req.json();
    if (!cobranca_id) return reply({ ok: false, error: "cobranca_id obrigatório" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: cob, error: cErr } = await admin
      .from("cobrancas_repasse")
      .select("spedy_order_id, spedy_invoice_id, spedy_invoice_status")
      .eq("id", cobranca_id)
      .single();

    if (cErr || !cob?.spedy_order_id) {
      return reply({ ok: false, error: "NFS-e ainda não foi solicitada para esta cobrança" }, 404);
    }

    // Busca order na Spedy
    const res = await fetch(`${SPEDY_BASE_URL}/orders/${cob.spedy_order_id}`, {
      headers: { "X-Api-Key": SPEDY_API_KEY },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return reply({ ok: false, error: `Spedy HTTP ${res.status}` }, 502);
    }

    const order = await res.json();
    const invoice = order?.invoices?.[0];

    if (!invoice) {
      return reply({ ok: true, spedy_invoice_status: "pending", message: "Nota ainda não processada" });
    }

    const STATUS_MAP: Record<string, string> = {
      authorized: "authorized",
      rejected:   "rejected",
      canceled:   "canceled",
      enqueued:   "pending",
      processing: "pending",
    };
    const mappedStatus = STATUS_MAP[invoice.status] ?? "pending";

    // Tenta capturar URL do PDF em diferentes campos possíveis
    const pdfUrl: string | null =
      invoice.pdfUrl ?? invoice.downloadUrl ?? invoice.pdf ??
      invoice.nfsePdf ?? invoice.linkDownloadNFSe ?? null;

    const nfseNumber: number | null = invoice.number ?? null;
    const errorMsg: string | null =
      invoice.processingDetail?.message ?? invoice.errorMessage ?? null;

    await admin.from("cobrancas_repasse").update({
      spedy_invoice_id:     invoice.id ?? cob.spedy_invoice_id,
      spedy_invoice_status: mappedStatus,
      spedy_nfse_number:    nfseNumber,
      spedy_nfse_pdf_url:   pdfUrl,
      spedy_invoice_error:  mappedStatus === "rejected" ? errorMsg : null,
    }).eq("id", cobranca_id);

    console.log(`[spedy-check-nfse] ${cobranca_id} → ${mappedStatus}, pdf=${pdfUrl}`);

    return reply({
      ok: true,
      spedy_invoice_status: mappedStatus,
      spedy_invoice_id:     invoice.id,
      spedy_nfse_number:    nfseNumber,
      spedy_nfse_pdf_url:   pdfUrl,
      spedy_invoice_error:  mappedStatus === "rejected" ? errorMsg : null,
    });
  } catch (e) {
    console.error("[spedy-check-nfse]", e);
    return reply({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

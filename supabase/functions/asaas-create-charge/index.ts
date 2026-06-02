import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://sandbox.asaas.com/api/v3";
const API_KEY  = Deno.env.get("ASAAS_API_KEY")  ?? "";

function ok(data: object) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function fail(message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function asaas<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "access_token": API_KEY,
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.errors?.[0]?.description ?? data?.message ?? `Asaas HTTP ${res.status}`);
  return data as T;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const cobranca_id: string = body?.cobranca_id ?? "";
    if (!cobranca_id) return fail("cobranca_id é obrigatório");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Cliente com JWT do usuário gestor — garante que as políticas RLS passam
    const db = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Cliente admin — usado só para writes que precisam ignorar RLS
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── 1. Buscar cobrança (usa JWT do gestor — RLS permite) ────────────
    const { data: cobranca, error: cErr } = await db
      .from("cobrancas_repasse")
      .select("*")
      .eq("id", cobranca_id)
      .single();

    console.log(`[asaas] cobranca=${cobranca?.id}, err=${cErr?.message}`);

    if (cErr || !cobranca) return fail("Cobrança não encontrada");
    if (cobranca.asaas_payment_id) return fail("Boleto já emitido para esta cobrança");
    if (cobranca.status === "pago") return fail("Cobrança já está paga");
    if (cobranca.status === "cancelado") return fail("Cobrança cancelada");

    // ── 2. Buscar pizzaria ──────────────────────────────────────────────
    const { data: pz, error: pzErr } = await admin
      .from("pizzarias")
      .select("id, nome, cnpj, telefone, email, asaas_customer_id")
      .eq("id", cobranca.pizzaria_id)
      .single();

    if (pzErr || !pz) return fail("Pizzaria não encontrada para esta cobrança");

    const cnpj = (pz.cnpj ?? "").replace(/\D/g, "");
    if (!cnpj) return fail(`A pizzaria "${pz.nome}" não tem CNPJ. Edite o cadastro da pizzaria e adicione o CNPJ.`);

    // ── 3. Garantir customer Asaas ──────────────────────────────────────
    let customerId: string = pz.asaas_customer_id ?? "";
    if (!customerId) {
      const customer = await asaas<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: pz.nome, cpfCnpj: cnpj,
          mobilePhone: (pz.telefone ?? "").replace(/\D/g, "") || undefined,
          email: pz.email || undefined,
          notificationDisabled: false,
        }),
      });
      customerId = customer.id;
      await admin.from("pizzarias").update({ asaas_customer_id: customerId }).eq("id", pz.id);
    }

    // ── 4. Criar pagamento ──────────────────────────────────────────────
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5);
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    const payment = await asaas<{ id: string; bankSlipUrl: string }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "BOLETO",
        value: Number(cobranca.valor_total_devido),
        dueDate: dueDateStr,
        description: `Pizza Premiada — comissão ${cobranca.periodo_inicio} a ${cobranca.periodo_fim}`,
        externalReference: cobranca_id,
        fine: { value: 2 }, interest: { value: 1 }, postalService: false,
      }),
    });

    // ── 5. Linha digitável ──────────────────────────────────────────────
    let linhaDigitavel: string | null = null;
    try {
      const info = await asaas<{ identificationField?: string }>(`/payments/${payment.id}/identificationField`);
      linhaDigitavel = info.identificationField ?? null;
    } catch (e) { console.warn("Linha digitável indisponível:", e); }

    // ── 6. Salvar no banco (admin — ignora RLS) ─────────────────────────
    await admin.from("cobrancas_repasse").update({
      asaas_payment_id: payment.id,
      boleto_url: payment.bankSlipUrl ?? null,
      boleto_linha_digitavel: linhaDigitavel,
      vencimento_boleto: dueDateStr,
      status: "enviado",
      data_envio: new Date().toISOString(),
    }).eq("id", cobranca_id);

    return ok({ payment_id: payment.id, boleto_url: payment.bankSlipUrl, linha_digitavel: linhaDigitavel, due_date: dueDateStr });

  } catch (e) {
    console.error("[asaas] exception:", e);
    return fail(e instanceof Error ? e.message : String(e));
  }
});

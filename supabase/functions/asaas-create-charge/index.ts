import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://sandbox.asaas.com/api/v3";
const API_KEY  = Deno.env.get("ASAAS_API_KEY") ?? "";

async function asaas<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "access_token": API_KEY,
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? data?.message ?? `Asaas HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { cobranca_id } = await req.json() as { cobranca_id: string };
    if (!cobranca_id) throw new Error("cobranca_id é obrigatório");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1. Carregar cobrança com dados da pizzaria ──────────────
    const { data: cobranca, error: cErr } = await supabase
      .from("cobrancas_repasse")
      .select("*, pizzarias(id, nome, cnpj, telefone, email, asaas_customer_id)")
      .eq("id", cobranca_id)
      .single();

    if (cErr || !cobranca) throw new Error("Cobrança não encontrada");
    if (cobranca.asaas_payment_id) throw new Error("Boleto já emitido para esta cobrança");
    if (cobranca.status === "pago") throw new Error("Cobrança já está paga");
    if (cobranca.status === "cancelado") throw new Error("Cobrança cancelada");

    const pz = cobranca.pizzarias as any;
    const cnpj = (pz.cnpj ?? "").replace(/\D/g, "");
    if (!cnpj) {
      throw new Error(
        `Pizzaria "${pz.nome}" não tem CNPJ cadastrado. Acesse o cadastro da pizzaria e informe o CNPJ antes de emitir o boleto.`,
      );
    }

    // ── 2. Garantir customer no Asaas ─────────────────────────
    let customerId: string = pz.asaas_customer_id ?? "";

    if (!customerId) {
      console.log(`[asaas-create-charge] Criando customer Asaas para "${pz.nome}"`);
      const customer = await asaas<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: pz.nome,
          cpfCnpj: cnpj,
          mobilePhone: (pz.telefone ?? "").replace(/\D/g, "") || undefined,
          email: pz.email || undefined,
          notificationDisabled: false,
        }),
      });
      customerId = customer.id;

      await supabase
        .from("pizzarias")
        .update({ asaas_customer_id: customerId })
        .eq("id", pz.id);
    }

    // ── 3. Criar pagamento (boleto) ────────────────────────────
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5); // vence em 5 dias úteis
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    const descricao = `Pizza Premiada — comissão ${cobranca.periodo_inicio} a ${cobranca.periodo_fim}`;

    const payment = await asaas<{ id: string; bankSlipUrl: string }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "BOLETO",
        value: Number(cobranca.valor_total_devido),
        dueDate: dueDateStr,
        description: descricao,
        externalReference: cobranca_id,   // ← chave para o webhook identificar a cobrança
        fine: { value: 2 },               // 2% de multa após vencimento
        interest: { value: 1 },           // 1% ao mês de juros
        postalService: false,
      }),
    });

    // ── 4. Buscar linha digitável ──────────────────────────────
    let linhaDigitavel: string | null = null;
    try {
      const boletoInfo = await asaas<{ identificationField?: string }>(
        `/payments/${payment.id}/identificationField`,
      );
      linhaDigitavel = boletoInfo.identificationField ?? null;
    } catch (e) {
      console.warn("[asaas-create-charge] Linha digitável indisponível:", e);
    }

    // ── 5. Salvar no banco ─────────────────────────────────────
    await supabase
      .from("cobrancas_repasse")
      .update({
        asaas_payment_id:      payment.id,
        boleto_url:            payment.bankSlipUrl ?? null,
        boleto_linha_digitavel: linhaDigitavel,
        vencimento_boleto:     dueDateStr,
        status:                "enviado",
        data_envio:            new Date().toISOString(),
      })
      .eq("id", cobranca_id);

    console.log(`[asaas-create-charge] Boleto criado: ${payment.id} para cobrança ${cobranca_id}`);

    return new Response(
      JSON.stringify({
        ok: true,
        payment_id:      payment.id,
        boleto_url:      payment.bankSlipUrl,
        linha_digitavel: linhaDigitavel,
        due_date:        dueDateStr,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("[asaas-create-charge]", err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const reply = (data: object, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // ── Calcular semana anterior no horário de Brasília (UTC-3) ──────────
    // Executado toda segunda às 8h BRT (11h UTC).
    // "Semana passada" = segunda anterior até domingo anterior.
    const nowUtc = new Date();
    // Converter para BRT subtraindo 3h
    const brt = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
    const dow = brt.getDay(); // 0=Dom, 1=Seg, ..., 6=Sáb
    const daysSinceMon = dow === 0 ? 6 : dow - 1; // dias desde segunda desta semana
    const thisMon = new Date(brt);
    thisMon.setDate(brt.getDate() - daysSinceMon);
    thisMon.setHours(0, 0, 0, 0);
    const prevMon = new Date(thisMon);
    prevMon.setDate(thisMon.getDate() - 7);
    const prevSun = new Date(prevMon);
    prevSun.setDate(prevMon.getDate() + 6);
    prevSun.setHours(23, 59, 59, 999);

    const periodoInicio = prevMon.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const periodoFim    = prevSun.toISOString().slice(0, 10);

    // UTC equivalentes para filtrar data_pedido (timestamptz no BD)
    // meia-noite BRT = 03:00 UTC
    const startUtc = new Date(periodoInicio + "T03:00:00.000Z");
    // 23:59:59 BRT do domingo = 02:59:59 UTC da segunda seguinte
    const endUtc   = new Date(periodoFim + "T03:00:00.000Z");
    endUtc.setTime(endUtc.getTime() + 24 * 60 * 60 * 1000 - 1000);

    console.log(`[auto-weekly-charges] Processando semana ${periodoInicio} a ${periodoFim}`);

    // ── Campanha principal ────────────────────────────────────────────────
    const { data: campanha } = await admin
      .from("campanhas")
      .select("*")
      .eq("is_principal", true)
      .limit(1)
      .single();
    if (!campanha) return reply({ ok: false, error: "Campanha principal não encontrada" }, 404);

    const taxaDel = campanha.taxa_delivery ?? 15;
    const taxaRet = campanha.taxa_retirada ?? 15;
    const taxaLoc = campanha.taxa_local    ?? 12;
    const getTaxa = (tipo: string | null) =>
      tipo === "retirada" ? taxaRet : tipo === "local" ? taxaLoc : taxaDel;

    // ── Pizzarias ─────────────────────────────────────────────────────────
    const { data: pizzarias } = await admin
      .from("pizzarias")
      .select("id, nome, cnpj, email, telefone, asaas_customer_id, endereco, cidade, bairro, cep")
      .order("nome");
    if (!pizzarias?.length) return reply({ ok: true, message: "Nenhuma pizzaria cadastrada", criadas: 0 });

    // ── Cobranças já existentes neste período (evita duplicação) ─────────
    const { data: existentes } = await admin
      .from("cobrancas_repasse")
      .select("pizzaria_id, pedidos_snapshot")
      .gte("periodo_inicio", periodoInicio)
      .lte("periodo_fim",    periodoFim)
      .neq("status", "cancelado");

    const pizzariasJaCobradas = new Set((existentes ?? []).map((c: any) => c.pizzaria_id));
    const pedidosJaCobertos   = new Set<string>();
    (existentes ?? []).forEach((c: any) => {
      if (Array.isArray(c.pedidos_snapshot)) c.pedidos_snapshot.forEach((id: string) => pedidosJaCobertos.add(id));
    });

    // ── Consumidores válidos ──────────────────────────────────────────────
    const { data: consumers } = await admin
      .from("consumidores")
      .select("id, usuarios(nome, telefone)");
    const validConsumerIds = new Set(
      (consumers ?? [])
        .filter((c: any) => c.usuarios?.nome && c.usuarios?.telefone)
        .map((c: any) => c.id),
    );

    // ── Pedidos da semana ─────────────────────────────────────────────────
    const { data: allPedidos } = await admin
      .from("pedidos")
      .select("id, pizzaria_id, consumidor_id, valor_total, tipo_pedido, canal, data_pedido")
      .eq("status", "entregue")
      .eq("campanha_id", campanha.id)
      .gte("data_pedido", startUtc.toISOString())
      .lte("data_pedido", endUtc.toISOString());

    const results: any[] = [];
    let criadas = 0;

    // ── Iterar pizzarias ──────────────────────────────────────────────────
    for (const pz of pizzarias) {
      if (pizzariasJaCobradas.has(pz.id)) {
        console.log(`[auto-weekly-charges] ${pz.nome}: já cobrada nesta semana, pulando.`);
        continue;
      }

      const pzPedidos = (allPedidos ?? []).filter((p: any) =>
        p.pizzaria_id === pz.id &&
        !pedidosJaCobertos.has(p.id) &&
        validConsumerIds.has(p.consumidor_id),
      );

      if (!pzPedidos.length) continue;

      // Calcular valores
      const delivery = pzPedidos.filter((p: any) => !p.tipo_pedido || p.tipo_pedido === "delivery");
      const retirada = pzPedidos.filter((p: any) => p.tipo_pedido === "retirada");
      const local    = pzPedidos.filter((p: any) => p.tipo_pedido === "local");
      const totalDel = delivery.reduce((s: number, p: any) => s + Number(p.valor_total), 0);
      const totalRet = retirada.reduce((s: number, p: any) => s + Number(p.valor_total), 0);
      const totalLoc = local.reduce((s: number, p: any) => s + Number(p.valor_total), 0);
      const ppDel    = totalDel * taxaDel / 100;
      const ppRet    = totalRet * taxaRet / 100;
      const ppLoc    = totalLoc * taxaLoc / 100;
      const autoSplit = pzPedidos
        .filter((p: any) => p.canal === "cardapioweb")
        .reduce((s: number, p: any) => s + Number(p.valor_total) * getTaxa(p.tipo_pedido) / 100, 0);
      const totalPP    = ppDel + ppRet + ppLoc;
      const valorDevido = +(totalPP - autoSplit).toFixed(2);

      if (valorDevido <= 0) {
        console.log(`[auto-weekly-charges] ${pz.nome}: saldo zero, pulando.`);
        continue;
      }

      if (!pz.cnpj?.replace(/\D/g, "")) {
        console.warn(`[auto-weekly-charges] ${pz.nome}: sem CNPJ, pulando.`);
        results.push({ pizzaria: pz.nome, aviso: "CNPJ não cadastrado — cobrança não gerada." });
        continue;
      }

      // Criar registro de cobrança
      const { data: nova, error: insertErr } = await admin
        .from("cobrancas_repasse")
        .insert({
          pizzaria_id:            pz.id,
          campanha_id:            campanha.id,
          periodo_inicio:         periodoInicio,
          periodo_fim:            periodoFim,
          total_vendas_automatico: pzPedidos.filter((p: any) => p.canal === "cardapioweb").reduce((s: number, p: any) => s + Number(p.valor_total), 0),
          total_vendas_manual:    pzPedidos.filter((p: any) => p.canal !== "cardapioweb").reduce((s: number, p: any) => s + Number(p.valor_total), 0),
          total_delivery:         totalDel,
          total_retirada:         totalRet,
          total_local:            totalLoc,
          taxa_delivery_aplicada: taxaDel,
          taxa_retirada_aplicada: taxaRet,
          taxa_local_aplicada:    taxaLoc,
          valor_automatico_pp:    autoSplit,
          valor_manual_devido:    valorDevido,
          valor_total_devido:     valorDevido,
          status:                 "pendente",
          data_agendada:          new Date().toISOString(),
          pedidos_snapshot:       pzPedidos.map((p: any) => p.id),
        })
        .select("id")
        .single();

      if (insertErr || !nova) {
        console.error(`[auto-weekly-charges] Erro ao criar cobrança para ${pz.nome}:`, insertErr?.message);
        results.push({ pizzaria: pz.nome, erro: insertErr?.message ?? "Insert falhou" });
        continue;
      }

      console.log(`[auto-weekly-charges] Cobrança ${nova.id} criada para ${pz.nome} (${pzPedidos.length} pedidos, R$ ${valorDevido})`);

      // Chamar asaas-create-charge para emitir boleto + NFS-e
      let boletoOk = false;
      let spedyOrderId: string | null = null;
      let chargeError: string | null = null;

      try {
        const chargeRes = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/asaas-create-charge`,
          {
            method: "POST",
            headers: {
              "Content-Type":  "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ cobranca_id: nova.id }),
            signal: AbortSignal.timeout(30000),
          },
        );
        const chargeData = await chargeRes.json().catch(() => null);
        boletoOk      = chargeData?.ok === true;
        spedyOrderId  = chargeData?.spedy_order_id ?? null;
        chargeError   = boletoOk ? null : (chargeData?.error ?? "Erro desconhecido");
        console.log(`[auto-weekly-charges] Asaas para ${pz.nome}: ok=${boletoOk} spedy=${spedyOrderId}`);
      } catch (err) {
        chargeError = err instanceof Error ? err.message : String(err);
        console.error(`[auto-weekly-charges] Asaas timeout/erro para ${pz.nome}:`, chargeError);
      }

      results.push({
        pizzaria:     pz.nome,
        cobranca_id:  nova.id,
        pedidos:      pzPedidos.length,
        valor:        valorDevido,
        boleto_ok:    boletoOk,
        spedy_order:  spedyOrderId,
        erro:         chargeError,
      });
      criadas++;
    }

    console.log(`[auto-weekly-charges] Concluído. ${criadas} cobrança(s) criada(s).`);
    return reply({
      ok:      true,
      periodo: `${periodoInicio} a ${periodoFim}`,
      criadas,
      results,
    });
  } catch (e) {
    console.error("[auto-weekly-charges]", e);
    return reply({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

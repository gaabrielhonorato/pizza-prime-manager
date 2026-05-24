// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    // ── Seed 1: pedidos/cupons/repasses (seed-test-data original) ────────────
    const { data: seed1 } = await supabase
      .from("integracoes")
      .select("config")
      .eq("nome", "seed_test_data")
      .maybeSingle();

    const cfg1 = (seed1?.config as any) ?? {};
    const pedidoIds1: string[] = cfg1?.pedido_ids ?? [];
    const cupomIds1: string[] = cfg1?.cupom_ids ?? [];
    const repasseIds1: string[] = cfg1?.repasse_ids ?? [];

    // ── Seed 2: consumidores + pedidos (seed-test-consumers-orders) ──────────
    const { data: seed2 } = await supabase
      .from("integracoes")
      .select("config")
      .eq("nome", "seed_consumidores_pedidos")
      .maybeSingle();

    const cfg2 = (seed2?.config as any) ?? {};
    const authUserIds: string[] = cfg2?.auth_user_ids ?? [];
    const consumidorIds: string[] = cfg2?.consumidor_ids ?? [];
    const pedidoIds2: string[] = cfg2?.pedido_ids ?? [];
    const cupomIds2: string[] = cfg2?.cupom_ids ?? [];

    // ── Deletar na ordem correta de FK ────────────────────────────────────────
    const allCupomIds = [...cupomIds1, ...cupomIds2];
    const allPedidoIds = [...pedidoIds1, ...pedidoIds2];

    if (allCupomIds.length > 0) {
      await supabase.from("cupons").delete().in("id", allCupomIds);
    }
    if (repasseIds1.length > 0) {
      await supabase.from("repasses").delete().in("id", repasseIds1);
    }
    if (allPedidoIds.length > 0) {
      await supabase.from("pedidos").delete().in("id", allPedidoIds);
    }
    if (consumidorIds.length > 0) {
      await supabase.from("consumidores").delete().in("id", consumidorIds);
    }

    // Deletar auth users — o CASCADE ON DELETE remove usuarios automaticamente
    let authDeleteCount = 0;
    for (const uid of authUserIds) {
      const { error } = await supabase.auth.admin.deleteUser(uid);
      if (!error) authDeleteCount++;
      else console.error(`Erro deletando auth user ${uid}:`, error.message);
    }

    // Remover registros de rastreamento
    if (seed1) await supabase.from("integracoes").delete().eq("nome", "seed_test_data");
    if (seed2) await supabase.from("integracoes").delete().eq("nome", "seed_consumidores_pedidos");

    return jsonResponse({
      success: true,
      deleted: {
        pedidos: allPedidoIds.length,
        cupons: allCupomIds.length,
        repasses: repasseIds1.length,
        consumidores: consumidorIds.length,
        auth_users: authDeleteCount,
      },
    });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, 500);
  }
});

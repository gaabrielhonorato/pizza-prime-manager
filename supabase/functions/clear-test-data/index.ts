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
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const { data: seed } = await supabase
      .from("integracoes")
      .select("config")
      .eq("nome", "seed_test_data")
      .maybeSingle();

    if (!seed) {
      return jsonResponse({ success: true, message: "Nenhum dado de teste registrado", deleted: { pedidos: 0, cupons: 0, repasses: 0 } });
    }

    const config = seed.config as any;
    const pedidoIds: string[] = config?.pedido_ids ?? [];
    const cupomIds: string[]  = config?.cupom_ids ?? [];
    const repasseIds: string[] = config?.repasse_ids ?? [];

    // Delete in reverse FK order: cupons → repasses → pedidos
    if (cupomIds.length > 0) {
      await supabase.from("cupons").delete().in("id", cupomIds);
    }
    if (repasseIds.length > 0) {
      await supabase.from("repasses").delete().in("id", repasseIds);
    }
    if (pedidoIds.length > 0) {
      await supabase.from("pedidos").delete().in("id", pedidoIds);
    }

    // Remove tracking record
    await supabase.from("integracoes").delete().eq("nome", "seed_test_data");

    return jsonResponse({
      success: true,
      deleted: { pedidos: pedidoIds.length, cupons: cupomIds.length, repasses: repasseIds.length },
    });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, 500);
  }
});

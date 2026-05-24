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
    // ── Gestor atual — todas as pizzarias importadas usam o ID dele ─────────
    const { data: gestor } = await supabase
      .from("usuarios")
      .select("id")
      .eq("perfil", "gestor")
      .limit(1)
      .single();

    if (!gestor) {
      return jsonResponse({ error: "Nenhum gestor encontrado" }, 400);
    }

    // ── Pizzarias sem conta própria (usuario_id = gestor) ───────────────────
    const { data: pizzarias, error: pErr } = await supabase
      .from("pizzarias")
      .select("id, nome, telefone, cnpj")
      .eq("usuario_id", gestor.id)
      .order("nome");

    if (pErr || !pizzarias?.length) {
      return jsonResponse({ error: "Nenhuma pizzaria para configurar", detalhes: pErr?.message }, 400);
    }

    const criados: string[] = [];
    const authUserIds: string[] = [];
    const erros: string[] = [];

    for (let i = 0; i < pizzarias.length; i++) {
      const p = pizzarias[i];
      const email = `parceiro${String(i + 1).padStart(4, "0")}@pizza-prime.app`;

      // Criar auth user
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password: "123456",
        email_confirm: true,
        user_metadata: { nome: p.nome, perfil: "pizzaria", telefone: p.telefone ?? null },
      });

      if (authErr || !authData.user) {
        erros.push(`${p.nome}: ${authErr?.message ?? "erro desconhecido"}`);
        continue;
      }

      const userId = authData.user.id;
      authUserIds.push(userId);

      // Inserir em usuarios diretamente (sem depender do timing do trigger)
      await supabase.from("usuarios").upsert(
        { id: userId, nome: p.nome, email, perfil: "pizzaria", ativo: true },
        { onConflict: "id" },
      );

      // Vincular pizzaria ao novo usuário
      await supabase.from("pizzarias").update({ usuario_id: userId }).eq("id", p.id);

      criados.push(p.nome);
    }

    // ── Salvar IDs para limpeza futura ───────────────────────────────────────
    const { data: existing } = await supabase
      .from("integracoes")
      .select("config")
      .eq("nome", "pizzaria_auth_accounts")
      .maybeSingle();

    const prev = (existing?.config as any) ?? {};
    await supabase.from("integracoes").upsert(
      {
        nome: "pizzaria_auth_accounts",
        provedor: "interno",
        status: "configured",
        config: {
          auth_user_ids: [...(prev.auth_user_ids ?? []), ...authUserIds],
          gerado_em: new Date().toISOString(),
        },
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "nome" },
    );

    return jsonResponse({
      success: true,
      contas_criadas: criados.length,
      erros: erros.length > 0 ? erros : undefined,
    });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, 500);
  }
});

// @ts-nocheck
// Edge Function: admin-update-user
// Permite ao gestor atualizar e-mail e senha do usuário Auth vinculado a uma pizzaria.
// Autenticação manual via auth.getUser() (compatível com ES256 e HS256).

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
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Configuração do servidor incompleta" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Valida token do chamador
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Não autorizado: token ausente" }, 401);
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) return jsonResponse({ error: "Não autorizado: token inválido" }, 401);

    const { data: callerProfile } = await supabaseAdmin
      .from("usuarios")
      .select("perfil")
      .eq("id", userData.user.id)
      .single();

    if (callerProfile?.perfil !== "gestor") {
      return jsonResponse({ error: "Apenas gestores podem executar esta ação" }, 403);
    }

    // Lê corpo
    let body: Record<string, any>;
    try { body = await req.json(); } catch { return jsonResponse({ error: "JSON inválido" }, 400); }

    const { pizzariaId, action, email, password } = body;

    if (!pizzariaId || !action) {
      return jsonResponse({ error: "pizzariaId e action são obrigatórios" }, 400);
    }

    // Localiza o usuário vinculado à pizzaria
    const { data: pizzaria, error: pizzError } = await supabaseAdmin
      .from("pizzarias")
      .select("usuario_id")
      .eq("id", pizzariaId)
      .single();

    if (pizzError || !pizzaria?.usuario_id) {
      return jsonResponse({ error: "Pizzaria não encontrada ou sem usuário vinculado" }, 404);
    }

    const userId = pizzaria.usuario_id;

    // ── Ação: atualizar e-mail ─────────────────────────────────────────
    if (action === "update-email") {
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return jsonResponse({ error: "E-mail inválido" }, 400);
      }

      const newEmail = email.trim().toLowerCase();

      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: newEmail,
        email_confirm: true,
      });

      if (authErr) {
        console.error("update-email auth error:", authErr.message);
        return jsonResponse({ error: authErr.message }, 400);
      }

      // Sincroniza na tabela usuarios
      await supabaseAdmin.from("usuarios").update({ email: newEmail }).eq("id", userId);

      return jsonResponse({ success: true });
    }

    // ── Ação: redefinir senha ──────────────────────────────────────────
    if (action === "update-password") {
      if (!password || typeof password !== "string" || password.length < 6) {
        return jsonResponse({ error: "A senha deve ter no mínimo 6 caracteres" }, 400);
      }

      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });

      if (authErr) {
        console.error("update-password auth error:", authErr.message);
        return jsonResponse({ error: authErr.message }, 400);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: `action inválida: "${action}"` }, 400);
  } catch (err) {
    console.error("Unexpected error in admin-update-user:", err);
    return jsonResponse({ error: "Erro interno do servidor" }, 500);
  }
});

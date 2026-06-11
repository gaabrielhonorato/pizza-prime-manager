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

function normalizePhone(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function sourceFromOrigin(origin: string) {
  return origin === "qr-embalagem" ? "qr-embalagem" : "site";
}

function tagFromSource(source: string) {
  return source === "qr-embalagem" ? "qr-embalagem-pré-cadastro-site" : "Pré-Cadastro-site";
}

function renderTemplate(template: string, data: Record<string, string>) {
  return Object.entries(data).reduce((message, [key, value]) => message.replaceAll(`{${key}}`, value), template);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Configuração do servidor incompleta" }, 500);

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Corpo da requisição inválido" }, 400);
  }

  const nome = String(body.nome || "").trim().replace(/\s+/g, " ");
  const telefone = normalizePhone(String(body.whatsapp || body.telefone || ""));
  const source = sourceFromOrigin(String(body.origem || body.source || "site"));
  const tag = tagFromSource(source);
  const termosAceitos = Boolean(body.termosAceitos || body.termsAccepted);
  const appUrl = String(body.appUrl || "https://app.pizzapremiada.com.br").replace(/\/$/, "");
  const linkCadastro = `${appUrl}/consumidor/cadastro?preCadastro=1`;

  if (nome.length < 3) return jsonResponse({ error: "Informe o nome completo." }, 400);
  if (telefone.length < 12) return jsonResponse({ error: "Informe um WhatsApp válido com DDD." }, 400);
  if (!termosAceitos) return jsonResponse({ error: "É necessário aceitar os termos e a política de privacidade." }, 400);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    let userId: string | null = null;

    const { data: existingUser } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("telefone", telefone)
      .eq("perfil", "consumidor")
      .order("criado_em", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingUser?.id) {
      userId = existingUser.id;
      await supabaseAdmin.from("usuarios").update({ nome, ativo: true }).eq("id", userId);
    } else {
      const email = `pre_${telefone}@placeholder.pizzapremiada.local`;
      const password = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome, telefone, perfil: "consumidor", origem_pre_cadastro: source },
      });

      if (authError || !authData?.user) {
        console.error("Create pre-register auth user error:", authError?.message);
        return jsonResponse({ error: "Não foi possível criar o pré-cadastro." }, 400);
      }

      userId = authData.user.id;
      await new Promise((resolve) => setTimeout(resolve, 150));
      const { error: profileError } = await supabaseAdmin.from("usuarios").upsert({
        id: userId,
        nome,
        email,
        telefone,
        perfil: "consumidor",
        ativo: true,
      }, { onConflict: "id" });

      if (profileError) throw profileError;
    }

    const { data: existingConsumer } = await supabaseAdmin
      .from("consumidores")
      .select("id, tags")
      .eq("usuario_id", userId)
      .maybeSingle();

    let consumidorId = existingConsumer?.id ?? null;
    const nextTags = Array.from(new Set([...(existingConsumer?.tags ?? []), tag]));
    const consumerPayload = {
      cadastro_completo: false,
      termos_aceitos: true,
      aceita_whatsapp: true,
      termos_versao: "site-pre-cadastro-2026-05",
      termos_aceitos_em: new Date().toISOString(),
      privacidade_versao: "site-pre-cadastro-2026-05",
      privacidade_aceita_em: new Date().toISOString(),
      whatsapp_aceito_em: new Date().toISOString(),
      consentimento_origem: source,
      pre_cadastro_origem: source,
      pre_cadastro_em: new Date().toISOString(),
      tags: nextTags,
    };

    if (consumidorId) {
      const { error } = await supabaseAdmin.from("consumidores").update(consumerPayload).eq("id", consumidorId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("consumidores")
        .insert({ usuario_id: userId, ...consumerPayload })
        .select("id")
        .single();
      if (error) throw error;
      consumidorId = inserted.id;
    }

    const { data: template } = await supabaseAdmin
      .from("whatsapp_templates")
      .select("mensagem, ativo")
      .eq("evento", "pre_cadastro_site")
      .maybeSingle();

    if (template?.ativo !== false) {
      const mensagem = renderTemplate(
        template?.mensagem || "Olá, {nome}! Seja bem-vindo(a) à Pizza Premiada 🍕\n\nSeu pré-cadastro foi recebido com sucesso.\n\nPara concorrer e ser contemplado nos prêmios, você precisa completar seu cadastro no sistema antes do sorteio.\n\nAcesse: {link_cadastro}",
        { nome, link_cadastro: linkCadastro, telefone },
      );

      await supabaseAdmin.from("disparos_whatsapp").insert({
        consumidor_id: consumidorId,
        tipo: "automatico",
        evento: "pre_cadastro_site",
        mensagem,
        status: "pendente",
      });
    }

    return jsonResponse({ success: true, consumidor_id: consumidorId, redirect_url: linkCadastro, tag });
  } catch (error) {
    console.error("site-pre-cadastro error:", error);
    return jsonResponse({ error: "Erro interno ao criar pré-cadastro." }, 500);
  }
});

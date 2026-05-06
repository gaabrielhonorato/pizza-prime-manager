// @ts-nocheck
// Edge Function: create-user
// Responsável por criar um usuário no Auth + registro correspondente (pizzaria,
// consumidor ou entregador) a partir de uma requisição do gestor.
//
// IMPORTANTE: Esta função precisa estar deployada com verify_jwt = false (ver
// supabase/config.toml), pois o gateway legado de verificação do Supabase não
// suporta JWT ES256 (chaves assimétricas). A validação do token é feita
// manualmente abaixo via auth.getUser(), que é totalmente compatível com
// ES256 e HS256.

// Versão pinada da lib para garantir suporte estável a ES256.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LEGAL_VERSION = "2026-04-27";


function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
      return jsonResponse({ error: "Configuração do servidor incompleta" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // === 1) Validação manual do token do chamador ===
    // (compatível tanto com HS256 quanto com ES256)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autorizado: token ausente" }, 401);
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return jsonResponse({ error: "Não autorizado: token vazio" }, 401);
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData?.user) {
      console.error("Auth error:", userError?.message);
      return jsonResponse({ error: "Não autorizado: token inválido" }, 401);
    }

    const callerId = userData.user.id;

    // Verifica se o chamador é gestor
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("usuarios")
      .select("perfil")
      .eq("id", callerId)
      .single();

    if (profileError || !callerProfile) {
      console.error("Profile fetch error:", profileError?.message);
      return jsonResponse({ error: "Perfil do chamador não encontrado" }, 403);
    }

    if (callerProfile.perfil !== "gestor") {
      return jsonResponse({ error: "Apenas gestores podem cadastrar usuários" }, 403);
    }

    // === 2) Leitura e validação do corpo ===
    let body: Record<string, any>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Corpo da requisição inválido (JSON esperado)" }, 400);
    }

    const { email, password, nome, cpf, telefone, perfil, extra } = body;

    if (!email || !password || !nome || !perfil) {
      return jsonResponse(
        { error: "Campos obrigatórios: email, password, nome, perfil" },
        400,
      );
    }

    if (typeof password !== "string" || password.length < 6) {
      return jsonResponse({ error: "A senha deve ter no mínimo 6 caracteres" }, 400);
    }

    const validPerfis = ["pizzaria", "consumidor", "entregador", "gestor"];
    if (!validPerfis.includes(perfil)) {
      return jsonResponse({ error: `Perfil inválido. Use: ${validPerfis.join(", ")}` }, 400);
    }

    // === 3) Cria o usuário no Auth ===
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        nome,
        cpf: cpf || null,
        telefone: telefone || null,
        perfil,
      },
    });

    if (authError || !authData?.user) {
      console.error("Create auth user error:", authError?.message);
      return jsonResponse(
        { error: authError?.message || "Erro ao criar usuário no Auth" },
        400,
      );
    }

    const userId = authData.user.id;

    // Pequeno delay para garantir que o trigger handle_new_user termine
    // de criar a linha em `usuarios` antes de inserirmos registros dependentes.
    await new Promise((r) => setTimeout(r, 150));

    // === 4) Cria registro específico por perfil ===

    if (perfil === "pizzaria" && extra) {
      const { error: pizzError } = await supabaseAdmin.from("pizzarias").insert({
        usuario_id: userId,
        nome: extra.nomePizzaria || nome,
        responsavel_nome: extra.responsavelNome || nome,
        cnpj: extra.cnpj || null,
        telefone: telefone || extra.telefone || "",
        endereco: extra.endereco || null,
        cidade: extra.cidade || "",
        bairro: extra.bairro || "",
        cep: extra.cep || null,
        latitude: extra.latitude ? Number(extra.latitude) : null,
        longitude: extra.longitude ? Number(extra.longitude) : null,
        google_maps_url: extra.googleMapsUrl || null,
        google_place_id: extra.googlePlaceId || null,
        status: extra.status || "ativa",
        matricula_paga: Boolean(extra.matriculaPaga),
      });

      if (pizzError) {
        console.error("Error creating pizzaria:", pizzError);
        return jsonResponse(
          {
            error: `Usuário criado, mas erro ao criar pizzaria: ${pizzError.message}`,
            user_id: userId,
          },
          207,
        );
      }
    }

    if (perfil === "consumidor" && extra) {
      const { error: consError } = await supabaseAdmin.from("consumidores").insert({
        usuario_id: userId,
        cidade: extra.cidade || null,
        bairro: extra.bairro || null,
        pizzaria_id: extra.pizzariaId || null,
        genero: extra.genero || null,
        data_nascimento: extra.dataNascimento || null,
        aceita_whatsapp: extra.aceitaWhatsapp === true,
        whatsapp_aceito_em: extra.aceitaWhatsapp === true ? new Date().toISOString() : null,
        whatsapp_revogado_em: extra.aceitaWhatsapp === true ? null : new Date().toISOString(),
        cadastro_completo: true,
        termos_aceitos: true,
        termos_versao: LEGAL_VERSION,
        termos_aceitos_em: new Date().toISOString(),
        privacidade_versao: LEGAL_VERSION,
        privacidade_aceita_em: new Date().toISOString(),
        consentimento_origem: "gestor_create_user",
      });

      if (consError) {
        console.error("Error creating consumidor:", consError);
        return jsonResponse(
          {
            error: `Usuário criado, mas erro ao criar consumidor: ${consError.message}`,
            user_id: userId,
          },
          207,
        );
      }
    }

    if (perfil === "entregador" && extra) {
      if (!extra.pizzariaId) {
        return jsonResponse(
          {
            error: "Entregador precisa de uma pizzaria vinculada",
            user_id: userId,
          },
          207,
        );
      }
      const { error: entError } = await supabaseAdmin.from("entregadores").insert({
        usuario_id: userId,
        pizzaria_id: extra.pizzariaId,
        disponivel: false,
      });

      if (entError) {
        console.error("Error creating entregador:", entError);
        return jsonResponse(
          {
            error: `Usuário criado, mas erro ao criar entregador: ${entError.message}`,
            user_id: userId,
          },
          207,
        );
      }
    }

    return jsonResponse({ success: true, user_id: userId });
  } catch (err) {
    console.error("Unexpected error in create-user:", err);
    return jsonResponse({ error: "Erro interno do servidor" }, 500);
  }
});

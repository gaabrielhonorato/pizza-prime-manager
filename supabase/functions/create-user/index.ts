import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify caller is authenticated gestor
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is gestor
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await supabaseUser.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("usuarios")
      .select("perfil")
      .eq("id", caller.id)
      .single();

    if (callerProfile?.perfil !== "gestor") {
      return new Response(JSON.stringify({ error: "Apenas gestores podem cadastrar usuários" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { email, password, nome, cpf, telefone, perfil, extra } = body;

    if (!email || !password || !nome || !perfil) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: email, password, nome, perfil" }), { status: 400, headers: corsHeaders });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, cpf: cpf || null, telefone: telefone || null, perfil },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers: corsHeaders });
    }

    const userId = authData.user.id;

    // The trigger handle_new_user should create the usuarios row automatically.
    // Now create profile-specific records based on perfil.

    if (perfil === "pizzaria" && extra) {
      const { error: pizzError } = await supabaseAdmin.from("pizzarias").insert({
        usuario_id: userId,
        nome: extra.nomePizzaria || nome,
        cnpj: extra.cnpj || null,
        telefone: telefone || extra.telefone || "",
        endereco: extra.endereco || null,
        cidade: extra.cidade || "",
        bairro: extra.bairro || "",
        cep: extra.cep || null,
        status: extra.status || "ativa",
        matricula_paga: extra.matriculaPaga || false,
      });
      if (pizzError) {
        console.error("Error creating pizzaria:", pizzError);
        return new Response(JSON.stringify({ error: `Usuário criado, mas erro ao criar pizzaria: ${pizzError.message}`, user_id: userId }), { status: 207, headers: corsHeaders });
      }
    }

    if (perfil === "consumidor" && extra) {
      const { error: consError } = await supabaseAdmin.from("consumidores").insert({
        usuario_id: userId,
        cidade: extra.cidade || null,
        bairro: extra.bairro || null,
        pizzaria_id: extra.pizzariaId || null,
        cadastro_completo: true,
        termos_aceitos: true,
      });
      if (consError) {
        console.error("Error creating consumidor:", consError);
        return new Response(JSON.stringify({ error: `Usuário criado, mas erro ao criar consumidor: ${consError.message}`, user_id: userId }), { status: 207, headers: corsHeaders });
      }
    }

    if (perfil === "entregador" && extra) {
      if (!extra.pizzariaId) {
        return new Response(JSON.stringify({ error: "Entregador precisa de uma pizzaria vinculada", user_id: userId }), { status: 207, headers: corsHeaders });
      }
      const { error: entError } = await supabaseAdmin.from("entregadores").insert({
        usuario_id: userId,
        pizzaria_id: extra.pizzariaId,
        disponivel: false,
      });
      if (entError) {
        console.error("Error creating entregador:", entError);
        return new Response(JSON.stringify({ error: `Usuário criado, mas erro ao criar entregador: ${entError.message}`, user_id: userId }), { status: 207, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), { headers: corsHeaders });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), { status: 500, headers: corsHeaders });
  }
});

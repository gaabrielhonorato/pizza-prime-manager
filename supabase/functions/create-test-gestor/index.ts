import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Delete existing user if any
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(u => u.email === "gestor@pizzapremiada.com");
  if (existing) {
    await supabase.from("usuarios").delete().eq("id", existing.id);
    await supabase.auth.admin.deleteUser(existing.id);
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: "gestor@pizzapremiada.com",
    password: "Admin@2025",
    email_confirm: true,
    user_metadata: { nome: "Administrador", perfil: "gestor" },
  });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });

  return new Response(JSON.stringify({ success: true, user_id: data.user.id }), { headers: corsHeaders });
});

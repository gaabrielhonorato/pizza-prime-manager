import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hasValidOptionalSecret(req: Request) {
  const expected = Deno.env.get("FUNCTION_SHARED_SECRET");
  if (!expected) return true;
  return req.headers.get("x-function-secret") === expected;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!hasValidOptionalSecret(req)) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const tables = ["pedidos", "cupons", "consumidores", "pizzarias", "campanhas", "premios", "usuarios"];
    const backup: Record<string, any[]> = {};

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select("*").limit(10000);
      if (error) {
        console.error(`Error fetching ${table}:`, error.message);
        backup[table] = [];
      } else {
        backup[table] = data ?? [];
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const fileName = `backup-${today}.json`;
    const jsonContent = JSON.stringify(backup, null, 2);
    const encoder = new TextEncoder();
    const fileData = encoder.encode(jsonContent);

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(fileName, fileData, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Delete backups older than 30 days
    const { data: files } = await supabase.storage.from("backups").list();
    if (files) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const oldFiles = files.filter(f => {
        const match = f.name.match(/backup-(\d{4}-\d{2}-\d{2})\.json/);
        if (!match) return false;
        return new Date(match[1]) < thirtyDaysAgo;
      });
      if (oldFiles.length > 0) {
        await supabase.storage.from("backups").remove(oldFiles.map(f => f.name));
      }
    }

    // Log success
    await supabase.from("logs_sistema").insert({
      tipo: "backup_diario",
      mensagem: `Backup diário realizado com sucesso: ${fileName}`,
      detalhes: { tables: Object.keys(backup).map(t => ({ table: t, rows: backup[t].length })) },
      status: "sucesso",
    });

    return new Response(JSON.stringify({ success: true, file: fileName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    // Log failure
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      await supabase.from("logs_sistema").insert({
        tipo: "backup_diario",
        mensagem: `Falha no backup diário: ${err.message}`,
        status: "falha",
      });
    } catch {}

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

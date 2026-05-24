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

const GOOGLE_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "";
const RADIUS = 15000; // 15km por ponto — com sobreposição cobre 30km do centro

// Grid de 5 pontos cobrindo ~30km do centro do DF (Plano Piloto)
const PONTOS = [
  { lat: -15.7801, lng: -47.9292, label: "Centro (Plano Piloto)" },
  { lat: -15.6454, lng: -47.9292, label: "Norte (Sobradinho)" },
  { lat: -15.9148, lng: -47.9292, label: "Sul (Gama)" },
  { lat: -15.7801, lng: -47.7863, label: "Leste (São Sebastião)" },
  { lat: -15.7801, lng: -48.0721, label: "Oeste (Ceilândia)" },
];

async function buscarPagina(url: string): Promise<any> {
  const r = await fetch(url);
  return r.json();
}

async function buscarPonto(lat: number, lng: number): Promise<any[]> {
  const resultados: any[] = [];
  let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${RADIUS}&keyword=pizzaria&language=pt-BR&type=restaurant&key=${GOOGLE_KEY}`;

  for (let pagina = 0; pagina < 3; pagina++) {
    const data = await buscarPagina(url);

    if (data.status === "REQUEST_DENIED") {
      throw new Error(`API negada: ${data.error_message ?? "verifique a GOOGLE_MAPS_API_KEY"}`);
    }
    if (data.status === "OVER_QUERY_LIMIT") {
      throw new Error("Limite de requisições do Google atingido");
    }
    if (data.status === "INVALID_REQUEST") {
      throw new Error(`Requisição inválida: ${data.error_message}`);
    }

    resultados.push(...(data.results ?? []));
    if (!data.next_page_token) break;

    // Google exige ~2s antes de aceitar o next_page_token
    await new Promise((r) => setTimeout(r, 2000));
    url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${data.next_page_token}&key=${GOOGLE_KEY}`;
  }

  return resultados;
}

function extrairBairro(vicinity: string | undefined): string {
  if (!vicinity) return "DF";
  const partes = vicinity.split(",").map((p) => p.trim());
  // "Rua X, Asa Norte, Brasília - DF" → queremos "Asa Norte"
  if (partes.length >= 2) {
    const penultimo = partes[partes.length - 2];
    if (!["Brasília", "DF", "Distrito Federal", "Brazil"].includes(penultimo)) {
      return penultimo;
    }
  }
  return partes[0] ?? "DF";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!GOOGLE_KEY) {
    return jsonResponse(
      {
        error: "GOOGLE_MAPS_API_KEY não configurada como secret no Supabase",
        instrucao:
          "Execute: supabase secrets set GOOGLE_MAPS_API_KEY=SUA_CHAVE --project-ref axbrjlxwslkpttvgsahi",
      },
      500,
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const body = await req.json().catch(() => ({}));

    // ── Modo teste: verifica conectividade com a API ──────────────────────────
    if (body.test) {
      const data = await buscarPagina(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=-15.7801,-47.9292&radius=1000&keyword=pizzaria&language=pt-BR&key=${GOOGLE_KEY}`,
      );
      return jsonResponse({
        status: data.status,
        resultados_primeira_pagina: data.results?.length ?? 0,
        erro: data.error_message ?? null,
        exemplo: data.results?.[0]
          ? { nome: data.results[0].name, place_id: data.results[0].place_id }
          : null,
      });
    }

    // ── Buscar gestor para vincular as pizzarias importadas ───────────────────
    const { data: gestor } = await supabase
      .from("usuarios")
      .select("id")
      .eq("perfil", "gestor")
      .limit(1)
      .single();

    if (!gestor) {
      return jsonResponse({ error: "Nenhum usuário gestor encontrado no sistema" }, 400);
    }

    // ── Busca em todos os pontos do grid ──────────────────────────────────────
    const todosResultados: any[] = [];
    const errosPontos: string[] = [];

    for (const ponto of PONTOS) {
      try {
        const resultados = await buscarPonto(ponto.lat, ponto.lng);
        todosResultados.push(...resultados);
        console.log(`${ponto.label}: ${resultados.length} resultados`);
      } catch (e) {
        const msg = `Erro em ${ponto.label}: ${String(e)}`;
        errosPontos.push(msg);
        console.error(msg);
      }
    }

    // ── Deduplicar por place_id ───────────────────────────────────────────────
    const vistos = new Set<string>();
    const unicos = todosResultados.filter((r) => {
      if (!r.place_id || vistos.has(r.place_id)) return false;
      vistos.add(r.place_id);
      return true;
    });

    // ── Filtrar place_ids já cadastrados no banco ─────────────────────────────
    const { data: existentes } = await supabase
      .from("pizzarias")
      .select("google_place_id")
      .not("google_place_id", "is", null);

    const idsExistentes = new Set(
      (existentes ?? []).map((p: any) => p.google_place_id),
    );
    const novas = unicos.filter((r) => !idsExistentes.has(r.place_id));

    if (novas.length === 0) {
      return jsonResponse({
        success: true,
        total_encontradas: unicos.length,
        ja_cadastradas: idsExistentes.size,
        novas_importadas: 0,
        erros: errosPontos,
      });
    }

    // ── Montar e inserir registros ────────────────────────────────────────────
    const registros = novas.map((r) => ({
      usuario_id: gestor.id,
      nome: r.name,
      telefone: "(61) 00000-0000",
      cidade: "Brasília",
      bairro: extrairBairro(r.vicinity),
      endereco: r.vicinity ?? "",
      status: "ativa",
      matricula_paga: false,
      google_place_id: r.place_id,
      latitude: r.geometry?.location?.lat ?? null,
      longitude: r.geometry?.location?.lng ?? null,
      observacoes: "Importado via Google Places — telefone pendente de verificação",
    }));

    let totalInserido = 0;
    const errosInsert: string[] = [];

    for (let i = 0; i < registros.length; i += 50) {
      const lote = registros.slice(i, i + 50);
      const { error } = await supabase.from("pizzarias").insert(lote);
      if (error) {
        errosInsert.push(error.message);
        console.error("Erro no lote:", error.message);
      } else {
        totalInserido += lote.length;
      }
    }

    return jsonResponse({
      success: true,
      total_encontradas: unicos.length,
      ja_cadastradas: idsExistentes.size,
      novas_importadas: totalInserido,
      erros_api: errosPontos.length > 0 ? errosPontos : undefined,
      erros_insert: errosInsert.length > 0 ? errosInsert : undefined,
    });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, 500);
  }
});

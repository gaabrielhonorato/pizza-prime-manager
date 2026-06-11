const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractCoordinates(value: string) {
  const decoded = decodeURIComponent(value);
  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|z|\/|$)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /[?&](?:query|q|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /\/search\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match) {
      return { latitude: Number(match[1]), longitude: Number(match[2]) };
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") return jsonResponse({ error: "Informe uma URL do Google Maps." }, 400);

    const initialCoordinates = extractCoordinates(url);
    if (initialCoordinates) return jsonResponse({ ...initialCoordinates, finalUrl: url });

    let finalUrl = url;
    const response = await fetch(url, { redirect: "follow" });
    finalUrl = response.url || url;

    const finalCoordinates = extractCoordinates(finalUrl);
    if (finalCoordinates) return jsonResponse({ ...finalCoordinates, finalUrl });

    const html = await response.text();
    const htmlCoordinates = extractCoordinates(html);
    if (htmlCoordinates) return jsonResponse({ ...htmlCoordinates, finalUrl });

    return jsonResponse({ error: "Não encontrei latitude e longitude nesse link." }, 422);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Erro ao resolver link do Google Maps." }, 500);
  }
});

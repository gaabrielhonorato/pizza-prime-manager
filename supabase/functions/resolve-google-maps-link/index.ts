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
    // Google Maps HTML embeds coordinates in various JS snippets
    /center=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /"lat":(-?\d+(?:\.\d+)?),"lng":(-?\d+(?:\.\d+)?)/,
    /\["(-?\d+\.\d+)",(-?\d+\.\d+)\]/,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      // Sanity-check: valid geo coordinates
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
    }
  }

  return null;
}

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") return jsonResponse({ error: "Informe uma URL do Google Maps." }, 400);

    // 1. Try to extract directly from the URL the user sent
    const initialCoordinates = extractCoordinates(url);
    if (initialCoordinates) return jsonResponse({ ...initialCoordinates, finalUrl: url });

    // 2. Follow redirects with a browser User-Agent (avoids Google blocking cloud IPs)
    let finalUrl = url;
    let html = "";
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(10000),
      });
      finalUrl = response.url || url;
      html = await response.text();
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error("[resolve-google-maps-link] fetch error:", msg);
      return jsonResponse({
        error: `Não consegui acessar o link do Google Maps (${msg}). Cole a URL completa do Google Maps com as coordenadas visíveis.`,
      }, 422);
    }

    // 3. Try final URL after redirect
    const finalCoordinates = extractCoordinates(finalUrl);
    if (finalCoordinates) return jsonResponse({ ...finalCoordinates, finalUrl });

    // 4. Try HTML body
    const htmlCoordinates = extractCoordinates(html);
    if (htmlCoordinates) return jsonResponse({ ...htmlCoordinates, finalUrl });

    console.error("[resolve-google-maps-link] coordinates not found in:", finalUrl.slice(0, 200));
    return jsonResponse({ error: "Não encontrei latitude e longitude nesse link. Tente copiar a URL completa na barra de endereços do Google Maps." }, 422);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao resolver link do Google Maps.";
    console.error("[resolve-google-maps-link] unexpected error:", msg);
    return jsonResponse({ error: msg }, 500);
  }
});

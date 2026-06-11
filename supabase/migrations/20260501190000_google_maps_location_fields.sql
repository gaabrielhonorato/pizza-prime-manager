ALTER TABLE public.pizzarias
  ADD COLUMN IF NOT EXISTS google_maps_url text,
  ADD COLUMN IF NOT EXISTS google_place_id text;

COMMENT ON COLUMN public.pizzarias.google_maps_url IS 'URL pública do local da pizzaria no Google Maps.';
COMMENT ON COLUMN public.pizzarias.google_place_id IS 'Place ID do Google usado para identificar o local da pizzaria.';

DROP FUNCTION IF EXISTS public.get_pizzarias_site();

CREATE FUNCTION public.get_pizzarias_site()
RETURNS TABLE(
  id uuid,
  nome text,
  endereco text,
  bairro text,
  cidade text,
  telefone text,
  status text,
  latitude double precision,
  longitude double precision,
  google_maps_url text,
  google_place_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.nome,
    p.endereco,
    p.bairro,
    p.cidade,
    p.telefone,
    p.status,
    p.latitude,
    p.longitude,
    p.google_maps_url,
    p.google_place_id
  FROM public.pizzarias p
  WHERE p.status = 'ativa'
  ORDER BY p.nome;
$$;

REVOKE ALL ON FUNCTION public.get_pizzarias_site() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pizzarias_site() TO anon, authenticated;

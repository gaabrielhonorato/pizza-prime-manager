ALTER TABLE public.pizzarias
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

COMMENT ON COLUMN public.pizzarias.latitude IS 'Latitude pública da pizzaria usada no mapa do site.';
COMMENT ON COLUMN public.pizzarias.longitude IS 'Longitude pública da pizzaria usada no mapa do site.';

CREATE OR REPLACE FUNCTION public.get_pizzarias_site()
RETURNS TABLE(
  id uuid,
  nome text,
  endereco text,
  bairro text,
  cidade text,
  telefone text,
  status text,
  latitude double precision,
  longitude double precision
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
    p.longitude
  FROM public.pizzarias p
  WHERE p.status = 'ativa'
  ORDER BY p.nome;
$$;

REVOKE ALL ON FUNCTION public.get_pizzarias_site() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pizzarias_site() TO anon, authenticated;

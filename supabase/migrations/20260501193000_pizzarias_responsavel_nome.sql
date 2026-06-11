ALTER TABLE public.pizzarias
  ADD COLUMN IF NOT EXISTS responsavel_nome text;

COMMENT ON COLUMN public.pizzarias.responsavel_nome IS 'Nome do dono, sócio, gerente ou responsável pela comunicação da pizzaria com a Pizza Premiada.';

UPDATE public.pizzarias p
SET responsavel_nome = COALESCE(NULLIF(p.responsavel_nome, ''), u.nome)
FROM public.usuarios u
WHERE p.usuario_id = u.id
  AND (p.responsavel_nome IS NULL OR p.responsavel_nome = '');

UPDATE public.pizzarias
SET status = 'ativa'
WHERE status = 'prospectada'
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

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

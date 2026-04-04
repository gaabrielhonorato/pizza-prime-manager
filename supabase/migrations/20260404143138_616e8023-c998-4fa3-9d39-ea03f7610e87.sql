
-- Add new columns to campanhas
ALTER TABLE public.campanhas ADD COLUMN is_principal boolean NOT NULL DEFAULT false;
ALTER TABLE public.campanhas ADD COLUMN campanha_pai_id uuid REFERENCES public.campanhas(id) ON DELETE SET NULL;
ALTER TABLE public.campanhas ADD COLUMN tipo text NOT NULL DEFAULT 'principal';
ALTER TABLE public.campanhas ADD COLUMN multiplicador_cupons numeric NOT NULL DEFAULT 1;
ALTER TABLE public.campanhas ADD COLUMN cupons_fixos_extras integer NOT NULL DEFAULT 0;
ALTER TABLE public.campanhas ADD COLUMN desconto_valor_minimo numeric NOT NULL DEFAULT 0;
ALTER TABLE public.campanhas ADD COLUMN pizzarias_permitidas uuid[];
ALTER TABLE public.campanhas ADD COLUMN periodo_inicio timestamp with time zone;
ALTER TABLE public.campanhas ADD COLUMN periodo_fim timestamp with time zone;
ALTER TABLE public.campanhas ADD COLUMN bonus_indicacao integer NOT NULL DEFAULT 0;

-- Add campanha_id to consumidores and usuarios
ALTER TABLE public.consumidores ADD COLUMN campanha_id uuid REFERENCES public.campanhas(id) ON DELETE SET NULL;
ALTER TABLE public.usuarios ADD COLUMN campanha_id uuid REFERENCES public.campanhas(id) ON DELETE SET NULL;

-- Trigger function: ensure only one principal
CREATE OR REPLACE FUNCTION public.ensure_single_principal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_principal = true THEN
    UPDATE public.campanhas SET is_principal = false WHERE id <> NEW.id AND is_principal = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ensure_single_principal
  BEFORE INSERT OR UPDATE ON public.campanhas
  FOR EACH ROW
  WHEN (NEW.is_principal = true)
  EXECUTE FUNCTION public.ensure_single_principal();

-- Function: get_campanha_principal
CREATE OR REPLACE FUNCTION public.get_campanha_principal()
RETURNS SETOF public.campanhas
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.campanhas WHERE is_principal = true LIMIT 1;
$$;

-- Function: get_subcampanhas_ativas
CREATE OR REPLACE FUNCTION public.get_subcampanhas_ativas(_campanha_pai_id uuid)
RETURNS SETOF public.campanhas
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.campanhas
  WHERE campanha_pai_id = _campanha_pai_id
    AND status = 'ativa'
    AND (periodo_inicio IS NULL OR periodo_inicio <= now())
    AND (periodo_fim IS NULL OR periodo_fim >= now());
$$;

-- Function: calcular_cupons
CREATE OR REPLACE FUNCTION public.calcular_cupons(_valor_pedido numeric, _pizzaria_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _principal public.campanhas;
  _cupons_base integer;
  _cupons_total integer;
  _sub record;
BEGIN
  SELECT * INTO _principal FROM public.campanhas WHERE is_principal = true LIMIT 1;
  IF _principal IS NULL THEN RETURN 0; END IF;
  IF _valor_pedido < _principal.valor_minimo_pedido THEN RETURN 0; END IF;
  _cupons_base := floor(_valor_pedido / _principal.valor_por_cupom) * _principal.cupons_por_valor;
  _cupons_total := _cupons_base;
  FOR _sub IN 
    SELECT * FROM public.campanhas
    WHERE campanha_pai_id = _principal.id
      AND status = 'ativa'
      AND (periodo_inicio IS NULL OR periodo_inicio <= now())
      AND (periodo_fim IS NULL OR periodo_fim >= now())
      AND (pizzarias_permitidas IS NULL OR _pizzaria_id = ANY(pizzarias_permitidas))
  LOOP
    _cupons_total := ceil(_cupons_total * _sub.multiplicador_cupons) + _sub.cupons_fixos_extras;
  END LOOP;
  RETURN _cupons_total;
END;
$$;


-- Fix: recreate view with SECURITY INVOKER
DROP VIEW IF EXISTS public.pizzarias_publicas;

CREATE VIEW public.pizzarias_publicas
WITH (security_invoker = true)
AS
SELECT id, nome, endereco, bairro, cidade, telefone, status
FROM public.pizzarias
WHERE status = 'ativa';

GRANT SELECT ON public.pizzarias_publicas TO authenticated;

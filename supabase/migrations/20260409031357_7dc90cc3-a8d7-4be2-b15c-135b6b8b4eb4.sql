
CREATE TABLE public.integracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'not_configured',
  provedor text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz
);

ALTER TABLE public.integracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor acesso total integracoes"
  ON public.integracoes
  FOR ALL
  TO authenticated
  USING (has_perfil(auth.uid(), 'gestor'));

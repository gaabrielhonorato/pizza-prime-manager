
-- Add cadastro_bonus_concedido to consumidores
ALTER TABLE public.consumidores
  ADD COLUMN IF NOT EXISTS cadastro_bonus_concedido boolean NOT NULL DEFAULT false;

-- Add bonus config fields to campanhas
ALTER TABLE public.campanhas
  ADD COLUMN IF NOT EXISTS bonus_cadastro_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bonus_cadastro_cupons integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS bonus_aniversario_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bonus_aniversario_multiplicador numeric NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS bonus_aniversario_tipo_pedido text;

-- Create cupons_bonus table
CREATE TABLE public.cupons_bonus (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consumidor_id uuid NOT NULL REFERENCES public.consumidores(id) ON DELETE CASCADE,
  campanha_id uuid NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  motivo text,
  status text NOT NULL DEFAULT 'validado',
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cupons_bonus ENABLE ROW LEVEL SECURITY;

-- Consumidor sees own bonus coupons
CREATE POLICY "Consumidor ve seus cupons bonus"
  ON public.cupons_bonus FOR SELECT
  TO authenticated
  USING (consumidor_id IN (
    SELECT id FROM public.consumidores WHERE usuario_id = auth.uid()
  ));

-- Gestor full access
CREATE POLICY "Gestor acesso total cupons bonus"
  ON public.cupons_bonus FOR ALL
  TO authenticated
  USING (has_perfil(auth.uid(), 'gestor'::text));

-- Index for fast lookups
CREATE INDEX idx_cupons_bonus_consumidor ON public.cupons_bonus(consumidor_id);
CREATE INDEX idx_cupons_bonus_campanha ON public.cupons_bonus(campanha_id);


ALTER TABLE public.campanhas
  ADD COLUMN IF NOT EXISTS percentual_comissao numeric NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS tipo_precificacao text NOT NULL DEFAULT 'valor_fixo',
  ADD COLUMN IF NOT EXISTS adesao_paga boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_adesao numeric NOT NULL DEFAULT 0;

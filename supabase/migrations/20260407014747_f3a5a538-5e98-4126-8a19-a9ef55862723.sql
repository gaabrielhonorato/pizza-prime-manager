
-- Add raffle sequence to campanhas
ALTER TABLE public.campanhas ADD COLUMN IF NOT EXISTS sequencia_cupons jsonb DEFAULT NULL;

-- Add winner fields to premios
ALTER TABLE public.premios ADD COLUMN IF NOT EXISTS ganhador_consumidor_id uuid DEFAULT NULL;
ALTER TABLE public.premios ADD COLUMN IF NOT EXISTS numero_sorteado_loteria integer DEFAULT NULL;
ALTER TABLE public.premios ADD COLUMN IF NOT EXISTS numero_cupom_contemplado integer DEFAULT NULL;
ALTER TABLE public.premios ADD COLUMN IF NOT EXISTS confirmado_em timestamp with time zone DEFAULT NULL;

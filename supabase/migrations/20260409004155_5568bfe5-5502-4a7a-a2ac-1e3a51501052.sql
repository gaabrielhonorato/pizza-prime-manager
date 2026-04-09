
-- Add new columns to pedidos
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS tipo_pedido text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS taxa_entrega numeric NOT NULL DEFAULT 0;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS desconto numeric NOT NULL DEFAULT 0;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS bairro_entrega text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS horario_pedido timestamptz;

-- Add new columns to consumidores
ALTER TABLE public.consumidores ADD COLUMN IF NOT EXISTS genero text;
ALTER TABLE public.consumidores ADD COLUMN IF NOT EXISTS data_nascimento date;
ALTER TABLE public.consumidores ADD COLUMN IF NOT EXISTS aceita_whatsapp boolean NOT NULL DEFAULT true;

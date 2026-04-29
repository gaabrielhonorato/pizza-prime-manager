-- LGPD consent hardening.
-- The migration is additive and preserves existing records. It only changes the
-- default for future WhatsApp opt-ins to require explicit consent.

ALTER TABLE public.consumidores
  ADD COLUMN IF NOT EXISTS termos_versao text,
  ADD COLUMN IF NOT EXISTS termos_aceitos_em timestamptz,
  ADD COLUMN IF NOT EXISTS privacidade_versao text,
  ADD COLUMN IF NOT EXISTS privacidade_aceita_em timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_aceito_em timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_revogado_em timestamptz,
  ADD COLUMN IF NOT EXISTS consentimento_origem text;

ALTER TABLE public.consumidores
  ALTER COLUMN aceita_whatsapp SET DEFAULT false;

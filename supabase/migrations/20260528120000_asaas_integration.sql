-- Asaas integration fields

-- Pizzarias: store Asaas customer ID + fiscal data
ALTER TABLE pizzarias
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS cnpj             text,
  ADD COLUMN IF NOT EXISTS email            text;

-- Cobranças: store boleto data returned by Asaas
ALTER TABLE cobrancas_repasse
  ADD COLUMN IF NOT EXISTS asaas_payment_id      text,
  ADD COLUMN IF NOT EXISTS boleto_url            text,
  ADD COLUMN IF NOT EXISTS boleto_linha_digitavel text,
  ADD COLUMN IF NOT EXISTS vencimento_boleto     date;

-- Index for fast webhook lookup by externalReference
CREATE INDEX IF NOT EXISTS idx_cobrancas_asaas_payment_id
  ON cobrancas_repasse (asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;

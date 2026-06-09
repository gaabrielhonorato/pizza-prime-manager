ALTER TABLE public.cobrancas_repasse
  ADD COLUMN IF NOT EXISTS spedy_order_id       text,
  ADD COLUMN IF NOT EXISTS spedy_invoice_id      text,
  ADD COLUMN IF NOT EXISTS spedy_invoice_status  text,
  ADD COLUMN IF NOT EXISTS spedy_nfse_number     bigint,
  ADD COLUMN IF NOT EXISTS spedy_nfse_pdf_url    text;

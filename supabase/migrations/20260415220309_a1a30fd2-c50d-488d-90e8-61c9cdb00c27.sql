
-- SECAP fields on campanhas
ALTER TABLE public.campanhas
  ADD COLUMN IF NOT EXISTS secap_numero_certificacao text,
  ADD COLUMN IF NOT EXISTS secap_data_autorizacao date,
  ADD COLUMN IF NOT EXISTS secap_orgao_autorizador text DEFAULT 'SECAP/ME',
  ADD COLUMN IF NOT EXISTS secap_numero_processo text,
  ADD COLUMN IF NOT EXISTS secap_regulamento_texto text,
  ADD COLUMN IF NOT EXISTS secap_regulamento_pdf_url text,
  ADD COLUMN IF NOT EXISTS secap_modalidade text DEFAULT 'Sorteio',
  ADD COLUMN IF NOT EXISTS secap_abrangencia text DEFAULT 'Municipal';

-- logs_sistema table
CREATE TABLE IF NOT EXISTS public.logs_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  mensagem text NOT NULL,
  detalhes jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'sucesso',
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.logs_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor acesso total logs_sistema"
  ON public.logs_sistema FOR ALL
  TO authenticated
  USING (has_perfil(auth.uid(), 'gestor'::text));

-- Allow service role to insert logs (from edge functions)
CREATE POLICY "Service role inserts logs"
  ON public.logs_sistema FOR INSERT
  TO service_role
  WITH CHECK (true);

-- documentos bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read documentos" ON storage.objects FOR SELECT USING (bucket_id = 'documentos');
CREATE POLICY "Gestor upload documentos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos' AND (SELECT has_perfil(auth.uid(), 'gestor')));

-- backups bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Service role full access backups" ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'backups');

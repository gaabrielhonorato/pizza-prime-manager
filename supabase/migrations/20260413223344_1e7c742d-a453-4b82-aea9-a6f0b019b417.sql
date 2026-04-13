
-- Add rate fields to campanhas
ALTER TABLE public.campanhas
  ADD COLUMN IF NOT EXISTS taxa_delivery numeric NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS taxa_retirada numeric NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS taxa_local numeric NOT NULL DEFAULT 12;

-- Create cobrancas_repasse table
CREATE TABLE public.cobrancas_repasse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pizzaria_id uuid NOT NULL REFERENCES public.pizzarias(id) ON DELETE CASCADE,
  campanha_id uuid NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  total_vendas_automatico numeric NOT NULL DEFAULT 0,
  total_vendas_manual numeric NOT NULL DEFAULT 0,
  total_delivery numeric NOT NULL DEFAULT 0,
  total_retirada numeric NOT NULL DEFAULT 0,
  total_local numeric NOT NULL DEFAULT 0,
  taxa_delivery_aplicada numeric NOT NULL DEFAULT 15,
  taxa_retirada_aplicada numeric NOT NULL DEFAULT 15,
  taxa_local_aplicada numeric NOT NULL DEFAULT 12,
  valor_automatico_pp numeric NOT NULL DEFAULT 0,
  valor_manual_devido numeric NOT NULL DEFAULT 0,
  valor_total_devido numeric NOT NULL DEFAULT 0,
  data_agendada timestamptz,
  status text NOT NULL DEFAULT 'pendente',
  data_envio timestamptz,
  data_pagamento timestamptz,
  observacao text,
  pedidos_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cobrancas_repasse ENABLE ROW LEVEL SECURITY;

-- Gestor full access
CREATE POLICY "Gestor acesso total cobrancas_repasse"
  ON public.cobrancas_repasse FOR ALL
  TO authenticated
  USING (has_perfil(auth.uid(), 'gestor'::text));

-- Pizzaria can view own
CREATE POLICY "Pizzaria ve suas cobrancas"
  ON public.cobrancas_repasse FOR SELECT
  TO authenticated
  USING (pizzaria_id IN (
    SELECT id FROM public.pizzarias WHERE usuario_id = auth.uid()
  ));

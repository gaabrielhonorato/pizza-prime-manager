
-- Tabela custos_operacionais
CREATE TABLE public.custos_operacionais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campanha_id UUID NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'operacional_mensal',
  valor NUMERIC NOT NULL DEFAULT 0,
  meses_aplicados INTEGER,
  valor_total_calculado NUMERIC NOT NULL DEFAULT 0,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custos_operacionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor acesso total custos_operacionais"
ON public.custos_operacionais
FOR ALL
TO authenticated
USING (has_perfil(auth.uid(), 'gestor'));

-- Tabela projecoes_vendas
CREATE TABLE public.projecoes_vendas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campanha_id UUID NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  nome_cenario TEXT NOT NULL,
  cor_cenario TEXT NOT NULL DEFAULT '#F97316',
  pizzarias_mes1 INTEGER NOT NULL DEFAULT 0,
  pizzarias_mes2 INTEGER NOT NULL DEFAULT 0,
  pizzarias_mes3 INTEGER NOT NULL DEFAULT 0,
  pizzarias_mes4 INTEGER NOT NULL DEFAULT 0,
  vendas_por_pizzaria_mes INTEGER NOT NULL DEFAULT 0,
  ticket_medio NUMERIC NOT NULL DEFAULT 0,
  percentual_pp NUMERIC NOT NULL DEFAULT 15,
  valor_matricula NUMERIC NOT NULL DEFAULT 799,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ
);

ALTER TABLE public.projecoes_vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor acesso total projecoes_vendas"
ON public.projecoes_vendas
FOR ALL
TO authenticated
USING (has_perfil(auth.uid(), 'gestor'));

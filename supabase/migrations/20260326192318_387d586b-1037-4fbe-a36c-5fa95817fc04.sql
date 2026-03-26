
-- ============================================
-- TABELA: usuarios (criada primeiro)
-- ============================================
CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  cpf text UNIQUE,
  telefone text,
  perfil text NOT NULL CHECK (perfil IN ('gestor', 'pizzaria', 'entregador', 'consumidor')),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  ultimo_acesso timestamptz
);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECURITY DEFINER FUNCTIONS (após tabela existir)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_perfil(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT perfil FROM public.usuarios WHERE id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_perfil(_user_id uuid, _perfil text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = _user_id AND perfil = _perfil
  )
$$;

-- RLS para usuarios
CREATE POLICY "Gestor acesso total usuarios" ON public.usuarios FOR ALL
  TO authenticated USING (public.has_perfil(auth.uid(), 'gestor'));

CREATE POLICY "Usuarios podem ver proprio perfil" ON public.usuarios FOR SELECT
  TO authenticated USING (auth.uid() = id);

CREATE POLICY "Usuarios podem atualizar proprio perfil" ON public.usuarios FOR UPDATE
  TO authenticated USING (auth.uid() = id);

-- ============================================
-- TABELA: pizzarias
-- ============================================
CREATE TABLE public.pizzarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  cnpj text,
  telefone text NOT NULL,
  cidade text NOT NULL,
  bairro text NOT NULL,
  cep text,
  endereco text,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'prospectada', 'inativa')),
  matricula_paga boolean NOT NULL DEFAULT false,
  data_entrada timestamptz NOT NULL DEFAULT now(),
  meta_mensal integer NOT NULL DEFAULT 400,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pizzarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor acesso total pizzarias" ON public.pizzarias FOR ALL
  TO authenticated USING (public.has_perfil(auth.uid(), 'gestor'));
CREATE POLICY "Pizzaria ve seus dados" ON public.pizzarias FOR SELECT
  TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "Pizzaria atualiza seus dados" ON public.pizzarias FOR UPDATE
  TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "Consumidor ve pizzarias ativas" ON public.pizzarias FOR SELECT
  TO authenticated USING (status = 'ativa');

-- ============================================
-- TABELA: entregadores
-- ============================================
CREATE TABLE public.entregadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  pizzaria_id uuid REFERENCES public.pizzarias(id) ON DELETE CASCADE NOT NULL,
  disponivel boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entregadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor acesso total entregadores" ON public.entregadores FOR ALL
  TO authenticated USING (public.has_perfil(auth.uid(), 'gestor'));
CREATE POLICY "Entregador ve seus dados" ON public.entregadores FOR SELECT
  TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "Entregador atualiza seus dados" ON public.entregadores FOR UPDATE
  TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "Pizzaria ve seus entregadores" ON public.entregadores FOR SELECT
  TO authenticated USING (
    pizzaria_id IN (SELECT id FROM public.pizzarias WHERE usuario_id = auth.uid())
  );

-- ============================================
-- TABELA: consumidores
-- ============================================
CREATE TABLE public.consumidores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
  pizzaria_id uuid REFERENCES public.pizzarias(id),
  cidade text,
  bairro text,
  cadastro_completo boolean NOT NULL DEFAULT false,
  termos_aceitos boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consumidores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor acesso total consumidores" ON public.consumidores FOR ALL
  TO authenticated USING (public.has_perfil(auth.uid(), 'gestor'));
CREATE POLICY "Consumidor ve seus dados" ON public.consumidores FOR SELECT
  TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "Consumidor atualiza seus dados" ON public.consumidores FOR UPDATE
  TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "Pizzaria ve consumidores vinculados" ON public.consumidores FOR SELECT
  TO authenticated USING (
    pizzaria_id IN (SELECT id FROM public.pizzarias WHERE usuario_id = auth.uid())
  );

-- ============================================
-- TABELA: campanhas
-- ============================================
CREATE TABLE public.campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'encerrada')),
  data_inicio date NOT NULL,
  data_encerramento date NOT NULL,
  data_sorteio timestamptz NOT NULL,
  valor_por_cupom numeric NOT NULL DEFAULT 50,
  cupons_por_valor integer NOT NULL DEFAULT 1,
  valor_minimo_pedido numeric NOT NULL DEFAULT 0,
  limite_cupons_consumidor integer,
  arredondamento text NOT NULL DEFAULT 'baixo' CHECK (arredondamento IN ('baixo', 'acumular')),
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor acesso total campanhas" ON public.campanhas FOR ALL
  TO authenticated USING (public.has_perfil(auth.uid(), 'gestor'));
CREATE POLICY "Autenticados podem ver campanhas ativas" ON public.campanhas FOR SELECT
  TO authenticated USING (status = 'ativa');

-- ============================================
-- TABELA: premios
-- ============================================
CREATE TABLE public.premios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid REFERENCES public.campanhas(id) ON DELETE CASCADE NOT NULL,
  posicao integer NOT NULL,
  nome text NOT NULL,
  descricao text,
  valor numeric NOT NULL,
  quantidade_ganhadores integer NOT NULL DEFAULT 1,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.premios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor acesso total premios" ON public.premios FOR ALL
  TO authenticated USING (public.has_perfil(auth.uid(), 'gestor'));
CREATE POLICY "Autenticados podem ver premios" ON public.premios FOR SELECT
  TO authenticated USING (true);

-- ============================================
-- TABELA: pedidos
-- ============================================
CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid REFERENCES public.campanhas(id) NOT NULL,
  pizzaria_id uuid REFERENCES public.pizzarias(id) NOT NULL,
  consumidor_id uuid REFERENCES public.consumidores(id),
  entregador_id uuid REFERENCES public.entregadores(id),
  valor_total numeric NOT NULL,
  canal text NOT NULL CHECK (canal IN ('cardapioweb', 'whatsapp', 'balcao', 'anuncios', 'indicacao', 'outros')),
  status text NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'em_preparo', 'saiu_entrega', 'entregue', 'cancelado')),
  cupons_gerados integer NOT NULL DEFAULT 0,
  data_pedido timestamptz NOT NULL DEFAULT now(),
  data_entrega timestamptz
);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor acesso total pedidos" ON public.pedidos FOR ALL
  TO authenticated USING (public.has_perfil(auth.uid(), 'gestor'));
CREATE POLICY "Pizzaria ve seus pedidos" ON public.pedidos FOR SELECT
  TO authenticated USING (pizzaria_id IN (SELECT id FROM public.pizzarias WHERE usuario_id = auth.uid()));
CREATE POLICY "Pizzaria atualiza seus pedidos" ON public.pedidos FOR UPDATE
  TO authenticated USING (pizzaria_id IN (SELECT id FROM public.pizzarias WHERE usuario_id = auth.uid()));
CREATE POLICY "Pizzaria insere pedidos" ON public.pedidos FOR INSERT
  TO authenticated WITH CHECK (pizzaria_id IN (SELECT id FROM public.pizzarias WHERE usuario_id = auth.uid()));
CREATE POLICY "Entregador ve pedidos atribuidos" ON public.pedidos FOR SELECT
  TO authenticated USING (entregador_id IN (SELECT id FROM public.entregadores WHERE usuario_id = auth.uid()));
CREATE POLICY "Entregador atualiza status pedidos" ON public.pedidos FOR UPDATE
  TO authenticated USING (entregador_id IN (SELECT id FROM public.entregadores WHERE usuario_id = auth.uid()));
CREATE POLICY "Consumidor ve seus pedidos" ON public.pedidos FOR SELECT
  TO authenticated USING (consumidor_id IN (SELECT id FROM public.consumidores WHERE usuario_id = auth.uid()));

-- ============================================
-- TABELA: cupons
-- ============================================
CREATE TABLE public.cupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid REFERENCES public.campanhas(id) NOT NULL,
  consumidor_id uuid REFERENCES public.consumidores(id) NOT NULL,
  pedido_id uuid REFERENCES public.pedidos(id) NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'validado', 'utilizado')),
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor acesso total cupons" ON public.cupons FOR ALL
  TO authenticated USING (public.has_perfil(auth.uid(), 'gestor'));
CREATE POLICY "Consumidor ve seus cupons" ON public.cupons FOR SELECT
  TO authenticated USING (consumidor_id IN (SELECT id FROM public.consumidores WHERE usuario_id = auth.uid()));
CREATE POLICY "Pizzaria ve cupons dos seus pedidos" ON public.cupons FOR SELECT
  TO authenticated USING (pedido_id IN (SELECT id FROM public.pedidos WHERE pizzaria_id IN (SELECT id FROM public.pizzarias WHERE usuario_id = auth.uid())));

-- ============================================
-- TABELA: repasses
-- ============================================
CREATE TABLE public.repasses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid REFERENCES public.campanhas(id) NOT NULL,
  pizzaria_id uuid REFERENCES public.pizzarias(id) NOT NULL,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  valor_bruto numeric NOT NULL,
  percentual_pizza_premiada numeric NOT NULL DEFAULT 15,
  valor_pizza_premiada numeric NOT NULL,
  valor_repasse numeric NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'pago')),
  data_pagamento timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.repasses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor acesso total repasses" ON public.repasses FOR ALL
  TO authenticated USING (public.has_perfil(auth.uid(), 'gestor'));
CREATE POLICY "Pizzaria ve seus repasses" ON public.repasses FOR SELECT
  TO authenticated USING (pizzaria_id IN (SELECT id FROM public.pizzarias WHERE usuario_id = auth.uid()));

-- ============================================
-- TABELA: custos
-- ============================================
CREATE TABLE public.custos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid REFERENCES public.campanhas(id) NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('premios', 'anuncios', 'cardapioweb', 'captacao', 'embalagens', 'outros')),
  data_lancamento date NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor acesso total custos" ON public.custos FOR ALL
  TO authenticated USING (public.has_perfil(auth.uid(), 'gestor'));

-- ============================================
-- TABELA: disparos_whatsapp
-- ============================================
CREATE TABLE public.disparos_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumidor_id uuid REFERENCES public.consumidores(id) NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('automatico', 'campanha')),
  evento text NOT NULL CHECK (evento IN ('boas_vindas', 'novo_cupom', 'resultado_sorteio', 'campanha_manual')),
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('enviado', 'falhou', 'pendente')),
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.disparos_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor acesso total disparos" ON public.disparos_whatsapp FOR ALL
  TO authenticated USING (public.has_perfil(auth.uid(), 'gestor'));
CREATE POLICY "Consumidor ve seus disparos" ON public.disparos_whatsapp FOR SELECT
  TO authenticated USING (consumidor_id IN (SELECT id FROM public.consumidores WHERE usuario_id = auth.uid()));

-- ============================================
-- TRIGGER: auto-criar registro em usuarios após signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, nome, email, cpf, telefone, perfil)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'cpf',
    NEW.raw_user_meta_data->>'telefone',
    COALESCE(NEW.raw_user_meta_data->>'perfil', 'consumidor')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

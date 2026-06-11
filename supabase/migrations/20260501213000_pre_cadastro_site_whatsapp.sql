alter table public.consumidores
  add column if not exists tags text[] not null default '{}',
  add column if not exists pre_cadastro_origem text,
  add column if not exists pre_cadastro_em timestamptz;

alter table public.disparos_whatsapp
  add column if not exists enviado_em timestamptz,
  add column if not exists erro_mensagem text,
  add column if not exists provider_message_id text;

alter table public.disparos_whatsapp
  drop constraint if exists disparos_whatsapp_evento_check;

alter table public.disparos_whatsapp
  add constraint disparos_whatsapp_evento_check
  check (evento in (
    'boas_vindas',
    'novo_cupom',
    'resultado_sorteio',
    'campanha_manual',
    'boas_vindas_cadastro_incompleto',
    'pre_cadastro_site'
  ));

create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  evento text not null unique,
  nome text not null,
  descricao text,
  mensagem text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz
);

alter table public.whatsapp_templates enable row level security;

drop policy if exists "Gestor acesso total whatsapp_templates" on public.whatsapp_templates;
create policy "Gestor acesso total whatsapp_templates" on public.whatsapp_templates for all
  to authenticated using (public.has_perfil(auth.uid(), 'gestor'));

insert into public.whatsapp_templates (evento, nome, descricao, mensagem, ativo)
values (
  'pre_cadastro_site',
  'Boas-vindas pré-cadastro',
  'Consumidor faz pré-cadastro pelo site ou QR das embalagens',
  '🍕 Olá, {nome}! Seja muito bem-vindo(a) à Pizza Premiada! 🎉\n\nSeu pré-cadastro foi realizado com sucesso e você já deu o primeiro passo para participar da promoção. 🚀\n\nAgora falta só uma etapa importante:\ncomplete seu cadastro no sistema para validar sua participação e poder ser contemplado(a) nos prêmios. 🏆✨\n\nSem o cadastro completo, não será possível confirmar a entrega do prêmio caso você seja sorteado(a), combinado?\n\n👉 Complete aqui:\n{link_cadastro}\n\nBoa sorte e bora concorrer! 🍀🍕',
  true
)
on conflict (evento) do nothing;

insert into public.integracoes (nome, status, provedor, config)
values (
  'whatsapp',
  'not_configured',
  'baileys-agent',
  '{"numero":"62994844792","agentUrl":"/whatsapp-agent"}'::jsonb
)
on conflict (nome) do update
set provedor = coalesce(public.integracoes.provedor, excluded.provedor),
    config = public.integracoes.config || excluded.config,
    atualizado_em = now();

grant usage on schema public to service_role;
grant all on table public.usuarios to service_role;
grant all on table public.consumidores to service_role;
grant all on table public.disparos_whatsapp to service_role;
grant all on table public.whatsapp_templates to service_role;

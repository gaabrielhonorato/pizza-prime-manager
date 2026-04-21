# Correções — Pizza Prime Manager

## O que foi corrigido

### Bug 1 — Label do campo "Responsável" confuso
**Arquivo:** `src/pages/gestor/Pizzarias.tsx`

- Label mudou de **"Responsável"** → **"Responsável da Pizzaria *"**
- Adicionado texto de ajuda: *"Nome completo do dono, sócio ou gerente responsável pela pizzaria (não o gestor que está cadastrando)"*
- Campo agora é **obrigatório** (validação no submit)
- Removido fallback que usava o nome da pizzaria quando responsável estava vazio
- Placeholders adicionados em todos os campos para melhor UX
- Asteriscos (*) visuais adicionados nos campos obrigatórios: Nome, Responsável, Telefone, Cidade, Bairro

### Bug 2 — Erro "Unsupported JWT algorithm ES256"
**Arquivos:** `supabase/config.toml` e `supabase/functions/create-user/index.ts`

O gateway das Edge Functions do Supabase rejeita JWTs assinados com ES256
(chaves assimétricas) antes mesmo de chegar no código da função. É um bug
conhecido da plataforma durante a migração das chaves legadas HS256 para
ES256.

**Solução aplicada:**
1. `config.toml` define `verify_jwt = false` para as Edge Functions — isso
   desabilita a validação no gateway legado.
2. A validação do usuário continua acontecendo **dentro** da função, via
   `supabaseAdmin.auth.getUser(token)`, que é compatível com ES256.
3. Função reescrita com:
   - Versão pinada do `@supabase/supabase-js@2.76.0` (suporte estável a ES256)
   - Validação melhor de entrada (senha mínima, perfis válidos)
   - Delay de 150ms antes de inserts dependentes (evita race condition com
     o trigger `handle_new_user`)
   - Tratamento de erros mais claro e logs estruturados

## Como subir no GitHub

Extraia o zip na raiz do seu repositório. Os arquivos vão substituir os
existentes respeitando a estrutura de pastas:

```
src/pages/gestor/Pizzarias.tsx
supabase/config.toml
supabase/functions/create-user/index.ts
```

Depois faça commit + push. O deploy do Cloudflare Workers roda automaticamente.

## Deploy das Edge Functions (importante!)

Os arquivos vão para o GitHub, mas as **Edge Functions do Supabase precisam
ser reimplantadas separadamente**. Existem 2 caminhos:

### Caminho A — via Supabase CLI (recomendado)

```bash
supabase functions deploy create-user --no-verify-jwt
```

### Caminho B — via Dashboard do Supabase

1. Entre no dashboard do projeto `axbrjlxwslkpttvgsahi`
2. **Edge Functions → create-user**
3. Na aba **Details** ou **Settings**, localize **Enforce JWT verification**
   (ou **Verify JWT**) e **desative** esse toggle
4. Reimplante copiando o conteúdo do novo `index.ts`

## Validação

Depois do deploy, teste o cadastro de pizzaria no app em produção. Se aparecer
qualquer outro erro, abra o console do navegador (F12) e me manda o log
completo da requisição.



## Plano: Reset completo do sistema (dados + usuários)

### O que será feito

1. **Limpar todas as tabelas de dados** na ordem correta (respeitando dependências):
   - cupons_bonus, cupons, pedidos, disparos_whatsapp, repasses, entregadores, consumidores, premios, custos_operacionais, custos, projecoes_vendas, integracoes, campanhas, pizzarias, usuarios

2. **Remover todos os usuários do auth** via Edge Function temporária que usa o service role para deletar usuários do `auth.users`

3. **Resultado**: Sistema completamente limpo, pronto para cadastro e testes manuais do zero

### Detalhes técnicos

- Uma migration com `TRUNCATE CASCADE` nas tabelas públicas
- Uma Edge Function `reset-auth-users` que lista e deleta todos os usuários via Admin API
- Após execução, a Edge Function será removida (é apenas utilitária)

### Importante

- Todos os dados serão permanentemente perdidos
- Você precisará criar novos usuários (gestor, pizzaria, consumidor) do zero para testar


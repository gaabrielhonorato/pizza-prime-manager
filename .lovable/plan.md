
# Plano — Reestruturação Financeiro do Gestor

## Fase 1: Banco de Dados (Migration)
- Criar tabela `custos_operacionais` com campos: campanha_id, descricao, categoria, valor, meses_aplicados, valor_total_calculado, observacao
- Criar tabela `projecoes_vendas` com campos: campanha_id, nome_cenario, cor_cenario, pizzarias_mes1-4, vendas_por_pizzaria_mes, ticket_medio, percentual_pp, valor_matricula
- RLS: Gestor acesso total em ambas

## Fase 2: Menu Lateral
- Transformar "Financeiro" em accordion expansível (igual Desempenho) com subabas: Visão Geral, Receitas, Custos, Repasses, Projeções
- Rotas: `/gestor/financeiro/visao-geral`, `/gestor/financeiro/receitas`, `/gestor/financeiro/custos`, `/gestor/financeiro/repasses`, `/gestor/financeiro/projecoes`

## Fase 3: Layout Financeiro
- Criar `FinanceiroLayout.tsx` com filtros globais (Período + Campanha) e `<Outlet />`

## Fase 4: Páginas
1. **Visão Geral** — Cards (Faturamento Total, Fat. PP 15%, Fat. Pizzarias 85%, Custos, Lucro, Margem%), gráfico de linhas Receitas vs Custos vs Lucro, tabela resumo mensal, exportação
2. **Receitas** — Cards (matrículas, comissões, receita média), gráfico de barras por pizzaria, tabela detalhada por pizzaria, tabela receita mensal, exportação
3. **Custos** — Cards por categoria, gráfico de pizza, formulário CRUD inline, tabela com editar/excluir, resumo automático, exportação
4. **Repasses** — Cards (total/pago/pendente/próximo), tabela com ações "Marcar como pago", histórico, exportação
5. **Projeções** — CRUD de cenários, formulário com cálculos em tempo real, tabela projeção mensal, cards resultado, gráfico comparativo, exportação

## Fase 5: Rotas (App.tsx)
- Adicionar rotas aninhadas para Financeiro com FinanceiroLayout

## Observações
- Manter a página Financeiro da Pizzaria intacta (rota diferente)
- Dados reais do Supabase (pedidos, pizzarias, repasses, custos_operacionais, projecoes_vendas)
- Exportação Excel/CSV com ExportButton existente
- Visual consistente com o tema do sistema (tokens semânticos)

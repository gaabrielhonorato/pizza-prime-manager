

## Plan: Modais avancados na aba Pizzarias do Gestor

This plan adds two large modal experiences to the Pizzarias page: (1) clicking a pizzaria name opens a 90%-screen analytics modal with tabs for Overview, Payment Methods, and Orders; (2) the eye button opens an 80%-screen read-only mirror of the pizzaria owner's panel.

### Architecture

Both modals will be separate components to keep `Pizzarias.tsx` manageable:
- `src/components/gestor/PizzariaMetricsModal.tsx` — analytics modal (name click)
- `src/components/gestor/PizzariaEspelhoModal.tsx` — read-only mirror (eye click)

### Technical Details

**File 1: `src/components/gestor/PizzariaMetricsModal.tsx`**
- Dialog with custom className `max-w-[90vw] h-[90vh]` and backdrop blur
- State: selected period preset, custom date range, payment method filter (multi), canal filter (multi), status filter (multi), min/max value
- Fetches `pedidos` from Supabase filtered by `pizzaria_id`, applies all filters client-side
- Three tabs via Radix Tabs:
  - **Visao Geral**: 5 KPI cards (pedidos, total vendido, ticket medio, cupons, repasse 85%) + Recharts LineChart (pedidos per day)
  - **Formas de Pagamento**: PieChart left + summary table right (payment method, qty, total, %, ticket medio)
  - **Pedidos**: Full table with all columns + footer totals + pagination
- Quick period buttons: Hoje, 7d, 30d, Este mes, Mes anterior, Todo ciclo
- Custom date pickers for start/end
- Multi-select checkboxes for payment, canal, status filters
- Min/Max value inputs
- "Aplicar" and "Limpar" buttons
- Counter: "Exibindo X pedidos · R$ Y"
- Export CSV button
- Note: `pedidos` table currently has no `forma_pagamento` column. Will add via migration.

**File 2: `src/components/gestor/PizzariaEspelhoModal.tsx`**
- Dialog with `max-w-[80vw] h-[90vh]` and backdrop blur
- Header: Pizza Premiada logo + pizzaria name + read-only badge + close button
- 4 tabs replicating the pizzaria portal (all data fetched by `pizzaria_id`):
  - **Dashboard**: KPI cards + BarChart pedidos/dia + campaign banner
  - **Financeiro**: repasses table with status badges
  - **Pedidos**: orders table with filters
  - **Clientes**: consumer list with aggregated metrics
- All read-only — no action buttons

**File 3: Database migration**
- Add `forma_pagamento` column (text, nullable) to `pedidos` table to support payment method analytics

**File 4: `src/pages/gestor/Pizzarias.tsx`**
- Import both new modals
- Make pizzaria name clickable (cursor-pointer, hover underline) → opens metrics modal
- Eye button → opens espelho modal
- Remove current Sheet detail drawer (replaced by espelho modal)
- Pass `pizzariaId` and `open/onClose` props to each modal

### Steps

1. Create migration adding `forma_pagamento` to `pedidos`
2. Create `PizzariaMetricsModal` with all 3 tabs, filters, and CSV export
3. Create `PizzariaEspelhoModal` with 4 read-only tabs mirroring pizzaria portal
4. Update `Pizzarias.tsx` to wire both modals and make name clickable


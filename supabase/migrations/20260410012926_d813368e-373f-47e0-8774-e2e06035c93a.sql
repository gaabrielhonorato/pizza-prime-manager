ALTER TABLE public.pedidos ADD COLUMN cardapioweb_order_id text;

CREATE UNIQUE INDEX idx_pedidos_cardapioweb_order_id ON public.pedidos (cardapioweb_order_id) WHERE cardapioweb_order_id IS NOT NULL;
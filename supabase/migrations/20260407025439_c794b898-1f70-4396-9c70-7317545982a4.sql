ALTER TABLE public.pizzarias ADD COLUMN IF NOT EXISTS cardapioweb_merchant_id text DEFAULT NULL;
ALTER TABLE public.pizzarias ADD COLUMN IF NOT EXISTS cardapioweb_api_key text DEFAULT NULL;
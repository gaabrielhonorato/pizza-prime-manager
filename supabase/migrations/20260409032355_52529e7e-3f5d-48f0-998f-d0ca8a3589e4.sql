
-- 1. Fix privilege escalation: prevent users from changing their own perfil
DROP POLICY IF EXISTS "Usuarios podem atualizar proprio perfil" ON public.usuarios;

CREATE POLICY "Usuarios podem atualizar proprio perfil"
ON public.usuarios
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND perfil = (SELECT u.perfil FROM public.usuarios u WHERE u.id = auth.uid()));

-- 2. Fix sensitive data exposure: replace broad consumer SELECT policy with restricted one
-- Drop the overly broad consumer policy
DROP POLICY IF EXISTS "Consumidor ve pizzarias ativas" ON public.pizzarias;

-- Create a safe public view for consumers
CREATE OR REPLACE VIEW public.pizzarias_publicas AS
SELECT id, nome, endereco, bairro, cidade, telefone, status
FROM public.pizzarias
WHERE status = 'ativa';

-- Grant access to the view for authenticated users
GRANT SELECT ON public.pizzarias_publicas TO authenticated;

-- Create a new restricted policy: consumers can only see their own linked pizzaria's full data
-- (through the consumidores table), not all active pizzarias
CREATE POLICY "Consumidor ve pizzarias ativas limitado"
ON public.pizzarias
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT c.pizzaria_id FROM public.consumidores c WHERE c.usuario_id = auth.uid()
  )
);

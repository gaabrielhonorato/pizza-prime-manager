
-- 1. Fix: Replace consumer policy with one that uses the safe view approach via RPC
-- Drop current consumer policy
DROP POLICY IF EXISTS "Consumidor ve pizzarias ativas limitado" ON public.pizzarias;

-- Create a security definer function that returns only safe columns for consumer's linked pizzaria
CREATE OR REPLACE FUNCTION public.get_minha_pizzaria_publica()
RETURNS TABLE(id uuid, nome text, endereco text, bairro text, cidade text, telefone text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.endereco, p.bairro, p.cidade, p.telefone, p.status
  FROM public.pizzarias p
  JOIN public.consumidores c ON c.pizzaria_id = p.id
  WHERE c.usuario_id = auth.uid();
$$;

-- 2. Fix: Use a trigger to prevent perfil changes (eliminates race condition risk)
CREATE OR REPLACE FUNCTION public.prevent_perfil_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.perfil IS DISTINCT FROM NEW.perfil THEN
    RAISE EXCEPTION 'Não é permitido alterar o perfil do usuário';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_perfil_change_trigger
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.prevent_perfil_change();

-- Simplify the update policy now that the trigger handles perfil protection
DROP POLICY IF EXISTS "Usuarios podem atualizar proprio perfil" ON public.usuarios;

CREATE POLICY "Usuarios podem atualizar proprio perfil"
ON public.usuarios
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

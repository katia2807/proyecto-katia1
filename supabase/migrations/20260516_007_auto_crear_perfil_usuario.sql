-- =============================================================================
-- Migración: trigger para auto-crear perfiles al registrar usuarios nuevos
-- + reparar usuarios existentes sin fila en perfiles
-- =============================================================================

-- 1. Función que crea el perfil cuando se agrega un usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.perfiles (
    user_id,
    organization_id,
    role,
    ui_role,
    full_name
  )
  VALUES (
    NEW.id,
    v_org_id,
    'owner_admin',
    'owner_admin',
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Trigger: se dispara después de cada INSERT en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Reparar usuarios YA existentes que no tienen perfil
--    (se ejecuta una sola vez; ON CONFLICT evita duplicados)
INSERT INTO public.perfiles (
  user_id,
  organization_id,
  role,
  ui_role,
  full_name
)
SELECT
  u.id,
  '00000000-0000-0000-0000-000000000001',
  'owner_admin',
  'owner_admin',
  COALESCE(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(u.email, '@', 1)
  )
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.perfiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

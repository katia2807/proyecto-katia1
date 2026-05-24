-- OLA 1: Tabla de preferencias de usuario
-- Persiste: tour completado, favoritos de sidebar, tema preferido, etc.

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clave           text NOT NULL,      -- ej: "tour_bienvenida_completado", "sidebar_favoritos"
  valor           jsonb NOT NULL,     -- valor flexible por clave
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, organization_id, clave)
);

CREATE INDEX IF NOT EXISTS idx_user_prefs_user_org
  ON public.user_preferences (user_id, organization_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_user_prefs_updated_at ON public.user_preferences;
CREATE TRIGGER trg_user_prefs_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: cada usuario solo ve sus propias preferencias
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_prefs_own" ON public.user_preferences
  FOR ALL USING (user_id = auth.uid() AND organization_id = app.current_org_id());

-- Función upsert de preferencia
CREATE OR REPLACE FUNCTION public.set_user_preference(
  p_clave text,
  p_valor jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id, organization_id, clave, valor)
  VALUES (auth.uid(), app.current_org_id(), p_clave, p_valor)
  ON CONFLICT (user_id, organization_id, clave)
  DO UPDATE SET valor = EXCLUDED.valor, updated_at = now();
END;
$$;

-- DOWN: DROP TABLE IF EXISTS public.user_preferences;

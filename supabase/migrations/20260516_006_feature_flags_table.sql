-- OLA 0: Tabla de feature flags
-- Permite activar/desactivar features por organización sin re-deployar.
-- También sirve para archivar elementos de UI "legacy" sin eliminarlos.

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  flag_key        text NOT NULL,       -- ej: "legacy.antifraude_toplevel", "ui.theme_claro"
  enabled         boolean NOT NULL DEFAULT false,
  descripcion     text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, flag_key)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_org
  ON public.feature_flags (organization_id, flag_key);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feature_flags_updated_at ON public.feature_flags;
CREATE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Semilla de flags para org por defecto
INSERT INTO public.feature_flags (organization_id, flag_key, enabled, descripcion) VALUES
  ('00000000-0000-0000-0000-000000000001', 'legacy.empleados_activos_kpi',  false, 'KPI "Empleados activos" en Inicio — archivado por minimalismo'),
  ('00000000-0000-0000-0000-000000000001', 'legacy.alertas_operativas_kpi', false, 'KPI "Alertas operativas" en Inicio — archivado, confunde con alertas críticas'),
  ('00000000-0000-0000-0000-000000000001', 'legacy.egresos_periodo_kpi',    false, 'KPI "Egresos del periodo" en Inicio — disponible en Caja'),
  ('00000000-0000-0000-0000-000000000001', 'legacy.movimientos_caja_inicio',false, 'Tabla movimientos en Inicio — vive en Caja'),
  ('00000000-0000-0000-0000-000000000001', 'legacy.antifraude_toplevel',    false, 'Antifraude como módulo top-level — fusionado en Reportes'),
  ('00000000-0000-0000-0000-000000000001', 'legacy.seguridad_toplevel',     false, 'Seguridad como módulo top-level — fusionado en Cuenta'),
  ('00000000-0000-0000-0000-000000000001', 'ui.tema_claro',                 false, 'Tema claro activado (default: oscuro)'),
  ('00000000-0000-0000-0000-000000000001', 'ui.tour_bienvenida_completado', false, 'Tour de bienvenida ya visto — no volver a mostrar'),
  ('00000000-0000-0000-0000-000000000001', 'feature.codigos_familiares',    true,  'Generación automática de códigos de producto'),
  ('00000000-0000-0000-0000-000000000001', 'feature.sugerencia_precios',    true,  'Sugerencia de precios basada en historial de ventas')
ON CONFLICT (organization_id, flag_key) DO NOTHING;

-- RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags_org_select" ON public.feature_flags
  FOR SELECT USING (organization_id = app.current_org_id());

CREATE POLICY "feature_flags_org_owner_write" ON public.feature_flags
  FOR ALL USING (
    organization_id = app.current_org_id()
    AND EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE user_id = auth.uid()
        AND organization_id = app.current_org_id()
        AND (role = 'owner' OR ui_role = 'owner_admin')
    )
  );

-- DOWN: ver 20260516_006_down_feature_flags_table.sql

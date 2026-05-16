-- OLA 1: Revisión y refuerzo de RLS policies
-- Garantiza que cada tabla nueva tenga policies correctas.
-- Las tablas antiguas ya tienen RLS desde el init.

-- audit_logs: solo owner/gerencia puede leer; insert via service_role
-- (Policies ya definidas en 20260517_001_audit_logs_table.sql)

-- notifications: usuario solo ve las suyas o las de toda la org
-- (Policies ya definidas en 20260517_002_notifications_table.sql)

-- user_preferences: solo el propio usuario
-- (Policies ya definidas en 20260517_004_user_preferences_table.sql)

-- feature_flags: select público (org), write solo owner
-- (Policies ya definidas en 20260516_006_feature_flags_table.sql)

-- codigo_producto_diccionario: org completa puede leer, owner puede editar
-- (Policies ya definidas en 20260516_005_codigos_familiares_productos.sql)

-- Verificar que inventario_productos tiene RLS habilitado
ALTER TABLE public.inventario_productos ENABLE ROW LEVEL SECURITY;

-- Verificar RLS en tablas clave (idempotente)
ALTER TABLE public.clientes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_caja     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_madera        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizaciones_unificadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alquileres           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_produccion   ENABLE ROW LEVEL SECURITY;

-- Registrar en system_events que se revisó RLS
DO $$
BEGIN
  -- Tabla system_events para trazabilidad de operaciones de sistema
  CREATE TABLE IF NOT EXISTS public.system_events (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    tipo            text NOT NULL,
    descripcion     text,
    metadata        jsonb,
    created_at      timestamptz DEFAULT now()
  );

  ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

  -- Solo owner puede ver eventos de sistema
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'system_events' AND policyname = 'system_events_owner_select'
  ) THEN
    CREATE POLICY "system_events_owner_select" ON public.system_events
      FOR SELECT USING (
        organization_id = app.current_org_id()
        AND EXISTS (
          SELECT 1 FROM public.perfiles p
          WHERE p.user_id = auth.uid()
            AND p.organization_id = app.current_org_id()
            AND (p.role = 'owner' OR p.ui_role = 'owner_admin')
        )
      );
  END IF;

  -- Registrar evento de revisión RLS
  INSERT INTO public.system_events (tipo, descripcion)
  VALUES ('rls_review', 'Revisión y refuerzo de RLS policies — OLA 1')
  ON CONFLICT DO NOTHING;
END
$$;

-- DOWN: No hay down significativo para policies review.

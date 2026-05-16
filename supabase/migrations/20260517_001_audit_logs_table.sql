-- OLA 1: Tabla de audit log
-- Registra acciones críticas del sistema para el dueño.
-- El dueño puede ver quién hizo qué y cuándo.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name       text,                          -- snapshot del nombre en el momento
  accion          text NOT NULL,                 -- "crear_cliente", "eliminar_producto", etc.
  modulo          text NOT NULL,                 -- "clientes", "inventario", "ventas", etc.
  entidad_id      text,                          -- UUID o correlativo del registro afectado
  entidad_nombre  text,                          -- snapshot del nombre del registro
  detalles        jsonb,                         -- datos adicionales (antes/despues para updates)
  ip_address      inet,
  created_at      timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
  ON public.audit_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_modulo
  ON public.audit_logs (organization_id, modulo, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
  ON public.audit_logs (organization_id, user_id, created_at DESC);

-- RLS: solo owner y gerencia pueden ver los logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_privileged" ON public.audit_logs
  FOR SELECT USING (
    organization_id = app.current_org_id()
    AND EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.user_id = auth.uid()
        AND p.organization_id = app.current_org_id()
        AND (p.role = 'owner' OR p.ui_role IN ('owner_admin', 'operaciones'))
    )
  );

-- Solo el servidor (service_role) puede insertar logs
-- Los inserts desde el cliente nunca deben ser directos
CREATE POLICY "audit_logs_insert_service" ON public.audit_logs
  FOR INSERT WITH CHECK (
    organization_id = app.current_org_id()
  );

-- Función helper para insertar log (se llama desde RPCs)
CREATE OR REPLACE FUNCTION public.log_accion(
  p_accion       text,
  p_modulo       text,
  p_entidad_id   text DEFAULT NULL,
  p_entidad_nombre text DEFAULT NULL,
  p_detalles     jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    organization_id, user_id, accion, modulo,
    entidad_id, entidad_nombre, detalles
  ) VALUES (
    app.current_org_id(), auth.uid(), p_accion, p_modulo,
    p_entidad_id, p_entidad_nombre, p_detalles
  );
EXCEPTION WHEN OTHERS THEN
  -- No interrumpir la operación principal si el log falla
  NULL;
END;
$$;

-- DOWN: DROP TABLE IF EXISTS public.audit_logs; DROP FUNCTION IF EXISTS public.log_accion;

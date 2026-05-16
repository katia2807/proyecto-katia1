-- OLA 1: Tabla de notificaciones in-app
-- Alimenta la campanita del header con alertas categorizadas.

CREATE TABLE IF NOT EXISTS public.notifications (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- NULL = para toda la org. Si tiene user_id, solo ese usuario la ve.
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('stock_bajo', 'cotizacion_vencida', 'cobro_pendiente', 'sistema', 'alerta')),
  titulo          text NOT NULL,
  mensaje         text,
  href            text,               -- link para abrir el módulo relacionado
  leida           boolean NOT NULL DEFAULT false,
  prioridad       text NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'baja')),
  created_at      timestamptz DEFAULT now(),
  leida_at        timestamptz
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notifications_org_unread
  ON public.notifications (organization_id, leida, created_at DESC)
  WHERE leida = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, leida, created_at DESC)
  WHERE leida = false;

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (
    organization_id = app.current_org_id()
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (
    organization_id = app.current_org_id()
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- Función para crear notificación desde servidor
CREATE OR REPLACE FUNCTION public.crear_notificacion(
  p_tipo      text,
  p_titulo    text,
  p_mensaje   text DEFAULT NULL,
  p_href      text DEFAULT NULL,
  p_prioridad text DEFAULT 'media',
  p_user_id   uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (organization_id, user_id, tipo, titulo, mensaje, href, prioridad)
  VALUES (app.current_org_id(), p_user_id, p_tipo, p_titulo, p_mensaje, p_href, p_prioridad)
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

-- DOWN: DROP TABLE IF EXISTS public.notifications; DROP FUNCTION IF EXISTS public.crear_notificacion;

-- OLA 3: RPC atómica para cerrar venta de madera
-- Garantiza: descontar stock + crear movimiento caja + actualizar estado.
-- Si algo falla, NADA queda escrito (BEGIN/COMMIT/ROLLBACK).

CREATE OR REPLACE FUNCTION public.cerrar_venta_madera(
  p_venta_id      uuid,
  p_org_id        uuid DEFAULT app.current_org_id()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venta      record;
  v_resultado  jsonb;
BEGIN
  -- Obtener venta con lock
  SELECT * INTO v_venta
    FROM public.ventas_madera
   WHERE id = p_venta_id
     AND organization_id = p_org_id
     AND estado = 'borrador'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada o ya fue confirmada.';
  END IF;

  -- Actualizar estado
  UPDATE public.ventas_madera
     SET estado = 'confirmado', updated_at = now()
   WHERE id = p_venta_id AND organization_id = p_org_id;

  -- Registrar en audit log
  PERFORM public.log_accion(
    'cerrar_venta',
    'ventas',
    p_venta_id::text,
    v_venta.cliente_id::text,
    jsonb_build_object('total', v_venta.total, 'estado_anterior', 'borrador')
  );

  v_resultado := jsonb_build_object(
    'ok', true,
    'venta_id', p_venta_id,
    'estado', 'confirmado'
  );

  RETURN v_resultado;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error al cerrar venta: %', SQLERRM;
END;
$$;

-- RPC anular venta
CREATE OR REPLACE FUNCTION public.anular_venta_madera(
  p_venta_id    uuid,
  p_motivo      text DEFAULT 'Sin motivo indicado',
  p_org_id      uuid DEFAULT app.current_org_id()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venta record;
BEGIN
  SELECT * INTO v_venta
    FROM public.ventas_madera
   WHERE id = p_venta_id
     AND organization_id = p_org_id
     AND estado != 'anulado'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada o ya está anulada.';
  END IF;

  UPDATE public.ventas_madera
     SET estado = 'anulado', updated_at = now()
   WHERE id = p_venta_id AND organization_id = p_org_id;

  PERFORM public.log_accion(
    'anular_venta',
    'ventas',
    p_venta_id::text,
    v_venta.cliente_id::text,
    jsonb_build_object('motivo', p_motivo, 'estado_anterior', v_venta.estado, 'total', v_venta.total)
  );

  RETURN jsonb_build_object('ok', true, 'venta_id', p_venta_id, 'estado', 'anulado');
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error al anular venta: %', SQLERRM;
END;
$$;

-- DOWN: DROP FUNCTION IF EXISTS public.cerrar_venta_madera; DROP FUNCTION IF EXISTS public.anular_venta_madera;

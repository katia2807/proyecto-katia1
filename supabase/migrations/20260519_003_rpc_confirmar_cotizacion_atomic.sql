-- OLA 3: RPC atómica para confirmar cotización y convertirla a venta
-- Acción: marcar cotización como cobrada + crear movimiento de caja.

CREATE OR REPLACE FUNCTION public.confirmar_cotizacion_cobrada(
  p_cotizacion_id  uuid,
  p_metodo_pago    text DEFAULT 'efectivo',
  p_org_id         uuid DEFAULT app.current_org_id()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cot    record;
  v_mov_id uuid;
BEGIN
  -- Obtener cotización con lock
  SELECT * INTO v_cot
    FROM public.cotizaciones_unificadas
   WHERE id = p_cotizacion_id
     AND organization_id = p_org_id
     AND estado_flujo NOT IN ('cobrada', 'cancelada')
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotización no encontrada, ya cobrada o cancelada.';
  END IF;

  -- Actualizar estado
  UPDATE public.cotizaciones_unificadas
     SET estado_flujo = 'cobrada'
   WHERE id = p_cotizacion_id AND organization_id = p_org_id;

  -- Crear movimiento de caja
  INSERT INTO public.movimientos_caja (
    organization_id, tipo, categoria, monto, fecha,
    descripcion, es_personal
  ) VALUES (
    p_org_id, 'ingreso', 'cotizacion_cobrada', v_cot.total,
    CURRENT_DATE,
    COALESCE(v_cot.correlativo, p_cotizacion_id::text) || ' — Cotización cobrada',
    false
  )
  RETURNING id INTO v_mov_id;

  -- Audit log
  PERFORM public.log_accion(
    'confirmar_cotizacion',
    'cotizaciones',
    p_cotizacion_id::text,
    v_cot.correlativo,
    jsonb_build_object(
      'total', v_cot.total,
      'metodo_pago', p_metodo_pago,
      'movimiento_caja_id', v_mov_id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'cotizacion_id', p_cotizacion_id,
    'movimiento_caja_id', v_mov_id,
    'total', v_cot.total
  );
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error al confirmar cotización: %', SQLERRM;
END;
$$;

-- DOWN: DROP FUNCTION IF EXISTS public.confirmar_cotizacion_cobrada;

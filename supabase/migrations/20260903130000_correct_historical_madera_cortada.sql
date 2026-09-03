-- Corrección guiada y auditable de comprobantes históricos de madera cortada.
-- No modifica inventario. Solo sincroniza caja para ventas al contado cuando
-- existe exactamente un movimiento activo y el período sigue abierto.

CREATE OR REPLACE FUNCTION public.corregir_venta_madera_cortada_historica(
  p_venta_id uuid,
  p_actor_id uuid,
  p_snapshot_esperado jsonb,
  p_precio_por_pt numeric,
  p_lineas_comprobante jsonb,
  p_total numeric,
  p_motivo text,
  p_sincronizar_caja boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venta public.ventas_madera_cortada%ROWTYPE;
  v_actor public.perfiles%ROWTYPE;
  v_linea jsonb;
  v_cantidad numeric;
  v_espesor numeric;
  v_ancho numeric;
  v_largo numeric;
  v_precio_unitario numeric;
  v_subtotal numeric;
  v_pt_linea numeric;
  v_total_pt_calculado numeric := 0;
  v_cantidad_calculada numeric := 0;
  v_subtotal_calculado numeric := 0;
  v_caja_count integer := 0;
  v_caja public.movimientos_caja%ROWTYPE;
  v_caja_actualizada boolean := false;
  v_antes jsonb;
  v_despues jsonb;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo identificar a la persona que realiza la corrección.';
  END IF;

  -- Esta RPC se usa desde el servidor. Si alguna sesión normal llegara a
  -- ejecutarla, no puede atribuir la acción a otro usuario.
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'No tienes permisos para realizar esta corrección.';
  END IF;

  SELECT * INTO v_actor
  FROM public.perfiles
  WHERE user_id = p_actor_id
    AND deactivated_at IS NULL;

  IF NOT FOUND OR NOT (v_actor.role::text = 'owner_admin' OR v_actor.ui_role = 'owner_admin') THEN
    RAISE EXCEPTION 'Solo Katia puede corregir comprobantes históricos.';
  END IF;

  SELECT * INTO v_venta
  FROM public.ventas_madera_cortada
  WHERE id = p_venta_id
    AND organization_id = v_actor.organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La venta de madera cortada no existe o pertenece a otra organización.';
  END IF;
  IF v_venta.estado::text <> 'confirmada' THEN
    RAISE EXCEPTION 'Solo se pueden corregir ventas confirmadas.';
  END IF;

  IF p_snapshot_esperado IS NULL
     OR round(COALESCE((p_snapshot_esperado ->> 'total')::numeric, -1), 2) <> round(v_venta.total, 2)
     OR round(COALESCE((p_snapshot_esperado ->> 'total_pt')::numeric, -1), 4) <> round(v_venta.total_pt, 4)
     OR round(COALESCE((p_snapshot_esperado ->> 'precio_por_pt')::numeric, -1), 4) <> round(v_venta.precio_por_pt, 4)
     OR COALESCE(p_snapshot_esperado -> 'lineas_comprobante', '[]'::jsonb)
        <> COALESCE(v_venta.lineas_comprobante, '[]'::jsonb) THEN
    RAISE EXCEPTION 'La venta cambió mientras la revisabas. Vuelve a abrirla antes de guardar.';
  END IF;

  IF p_precio_por_pt IS NULL OR p_precio_por_pt <= 0 THEN
    RAISE EXCEPTION 'El precio por PT debe ser mayor que cero.';
  END IF;
  IF p_total IS NULL OR p_total <= 0 THEN
    RAISE EXCEPTION 'El total corregido debe ser mayor que cero.';
  END IF;
  IF length(trim(COALESCE(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'Explica el motivo de la corrección con al menos 10 caracteres.';
  END IF;
  IF jsonb_typeof(p_lineas_comprobante) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_lineas_comprobante) = 0 THEN
    RAISE EXCEPTION 'Debes completar al menos una línea para la boleta.';
  END IF;

  FOR v_linea IN SELECT value FROM jsonb_array_elements(p_lineas_comprobante)
  LOOP
    BEGIN
      v_cantidad := (v_linea ->> 'cantidad')::numeric;
      v_espesor := (v_linea ->> 'espesor')::numeric;
      v_ancho := (v_linea ->> 'ancho')::numeric;
      v_largo := (v_linea ->> 'largo')::numeric;
      v_precio_unitario := (v_linea ->> 'precio_unitario')::numeric;
      v_subtotal := (v_linea ->> 'subtotal')::numeric;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Una línea contiene cantidades, medidas o precios inválidos.';
    END;

    IF length(trim(COALESCE(v_linea ->> 'descripcion', ''))) = 0
       OR v_cantidad <= 0 OR v_espesor <= 0 OR v_ancho <= 0 OR v_largo <= 0 THEN
      RAISE EXCEPTION 'Todas las líneas necesitan descripción, cantidad, espesor, ancho y largo.';
    END IF;

    v_pt_linea := (v_espesor * v_ancho * v_largo / 12) * v_cantidad;
    IF abs(v_precio_unitario - ((v_espesor * v_ancho * v_largo / 12) * p_precio_por_pt)) > 0.01 THEN
      RAISE EXCEPTION 'El precio por pieza no coincide con el PT real de sus medidas.';
    END IF;
    IF abs(v_subtotal - round(v_pt_linea * p_precio_por_pt, 2)) > 0.009 THEN
      RAISE EXCEPTION 'El subtotal de una línea no coincide con su cantidad y medidas.';
    END IF;

    v_total_pt_calculado := v_total_pt_calculado + v_pt_linea;
    v_cantidad_calculada := v_cantidad_calculada + v_cantidad;
    v_subtotal_calculado := v_subtotal_calculado + v_subtotal;
  END LOOP;

  -- La corrección es documental. Si cambia el PT, también cambiaría el stock;
  -- por seguridad ese caso necesita otro proceso y queda bloqueado aquí.
  IF abs(v_total_pt_calculado - v_venta.total_pt) > 0.01 THEN
    RAISE EXCEPTION 'Las medidas no reproducen el PT registrado. No se guardó nada para proteger el inventario.';
  END IF;

  IF round(v_venta.total, 2) <> round(p_total, 2) AND v_venta.modalidad_pago = 'contado' THEN
    SELECT count(*) INTO v_caja_count
    FROM public.movimientos_caja
    WHERE organization_id = v_venta.organization_id
      AND referencia_id = v_venta.id
      AND modulo_origen = 'ventas_madera_cortada'
      AND voided_at IS NULL;

    IF NOT p_sincronizar_caja OR v_caja_count <> 1 THEN
      RAISE EXCEPTION 'El total cambia y caja no tiene un único movimiento activo. Revisa caja antes de continuar.';
    END IF;

    SELECT * INTO v_caja
    FROM public.movimientos_caja
    WHERE organization_id = v_venta.organization_id
      AND referencia_id = v_venta.id
      AND modulo_origen = 'ventas_madera_cortada'
      AND voided_at IS NULL
    FOR UPDATE;

    IF v_caja.periodo_cerrado THEN
      RAISE EXCEPTION 'El movimiento pertenece a un período cerrado y no puede modificarse.';
    END IF;

    UPDATE public.movimientos_caja
    SET monto = round(p_total, 2),
        descripcion = CONCAT(
          'Venta corregida ',
          trim(to_char(v_cantidad_calculada, 'FM999999990.####')),
          ' pzs (', v_venta.tipo_corte, ')'
        ),
        updated_by = p_actor_id
    WHERE id = v_caja.id;
    v_caja_actualizada := true;
  END IF;

  v_antes := jsonb_build_object(
    'total', v_venta.total,
    'total_pt', v_venta.total_pt,
    'precio_por_pt', v_venta.precio_por_pt,
    'cantidad_piezas', v_venta.cantidad_piezas,
    'precio_unitario_comercial', v_venta.precio_unitario_comercial,
    'lineas_comprobante', COALESCE(v_venta.lineas_comprobante, '[]'::jsonb)
  );

  UPDATE public.ventas_madera_cortada
  SET precio_por_pt = p_precio_por_pt,
      cantidad_piezas = v_cantidad_calculada,
      precio_unitario_comercial = round(p_total / v_cantidad_calculada, 2),
      lineas_comprobante = p_lineas_comprobante,
      total = round(p_total, 2)
  WHERE id = v_venta.id;

  v_despues := jsonb_build_object(
    'total', round(p_total, 2),
    'total_pt', v_venta.total_pt,
    'precio_por_pt', p_precio_por_pt,
    'cantidad_piezas', v_cantidad_calculada,
    'precio_unitario_comercial', round(p_total / v_cantidad_calculada, 2),
    'lineas_comprobante', p_lineas_comprobante
  );

  INSERT INTO public.audit_logs (
    organization_id,
    user_id,
    user_name,
    accion,
    modulo,
    entidad_id,
    entidad_nombre,
    detalles
  ) VALUES (
    v_venta.organization_id,
    p_actor_id,
    v_actor.full_name,
    'CORREGIR_COMPROBANTE_HISTORICO',
    'ventas_madera_cortada',
    v_venta.id::text,
    CONCAT('Venta ', upper(substr(v_venta.id::text, 1, 8))),
    jsonb_build_object(
      'motivo', trim(p_motivo),
      'antes', v_antes,
      'despues', v_despues,
      'subtotal_por_pt_real', round(v_subtotal_calculado, 2),
      'caja_actualizada', v_caja_actualizada,
      'inventario', 'sin_cambios'
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'venta_id', v_venta.id,
    'total_anterior', v_venta.total,
    'total_nuevo', round(p_total, 2),
    'caja_actualizada', v_caja_actualizada,
    'inventario_actualizado', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.corregir_venta_madera_cortada_historica(
  uuid, uuid, jsonb, numeric, jsonb, numeric, text, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.corregir_venta_madera_cortada_historica(
  uuid, uuid, jsonb, numeric, jsonb, numeric, text, boolean
) TO service_role;

COMMENT ON FUNCTION public.corregir_venta_madera_cortada_historica(
  uuid, uuid, jsonb, numeric, jsonb, numeric, text, boolean
) IS 'Corrige de forma atómica el detalle histórico de una boleta de madera cortada, audita el cambio y nunca modifica inventario.';

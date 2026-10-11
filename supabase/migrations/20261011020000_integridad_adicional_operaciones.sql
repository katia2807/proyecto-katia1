-- Protege operaciones futuras; no reescribe registros del negocio.
begin;

create or replace function public.comprobar_autor_financiero(p_org uuid,p_actor uuid,p_roles text[])
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if not exists(select 1 from public.perfiles where organization_id=p_org and user_id=p_actor
    and deactivated_at is null and (case
      when ui_role='owner_admin' then 'owner_admin' when ui_role='operaciones' then 'gerencia'
      when ui_role='readonly' then 'vendedor' when role::text='partner_readonly' then 'vendedor'
      when role::text='operaciones_caja' then 'caja' else role::text end)=any(p_roles)) then
    raise exception 'No autorizado para esta operación';
  end if;
  -- Todos los RPC financieros toman este bloqueo antes del documento o stock.
  perform public.bloquear_operacion_empresa(p_org);
end $$;

-- Sincronizar por identidad, también desde el trigger anidado de Kardex.
-- El trigger inverso ya evita recursión; esta función sale cuando no hay diferencias.
create or replace function public.sync_inventario_to_catalogo()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if new.categoria='Muebles' then
    insert into public.muebles_catalogo(id,organization_id,codigo,nombre,descripcion,precio_lista,stock_disponible,foto_url,activo,created_at)
    values(new.id,new.organization_id,new.codigo,new.nombre,'Producto importado del inventario',0,new.stock_actual,new.foto_url,new.activo,new.created_at)
    on conflict(id) do update set codigo=excluded.codigo,nombre=excluded.nombre,stock_disponible=excluded.stock_disponible,
      foto_url=excluded.foto_url,activo=excluded.activo
    where muebles_catalogo.organization_id=excluded.organization_id and
      (muebles_catalogo.codigo,muebles_catalogo.nombre,muebles_catalogo.stock_disponible,muebles_catalogo.foto_url,muebles_catalogo.activo)
      is distinct from (excluded.codigo,excluded.nombre,excluded.stock_disponible,excluded.foto_url,excluded.activo);
  end if;
  return new;
end $$;

create or replace function public.movimiento_inventario_vinculado(p_org uuid,p_id uuid,p_referencia text)
returns boolean language sql stable security invoker set search_path=pg_catalog,public as $$
  select coalesce(p_referencia ~ '^(venta:|venta_madera_cortada:|anulacion:|devolucion:)',false)
    or exists(select 1 from public.movimientos_caja where organization_id=p_org and modulo_origen='inventario' and referencia_id=p_id)
    or exists(select 1 from public.operaciones_financieras_seguras where organization_id=p_org and tipo='compra_inventario' and resultado_id=p_id);
$$;
create or replace function public.proteger_borrado_kardex()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  perform public.bloquear_operacion_empresa(old.organization_id);
  if public.movimiento_inventario_vinculado(old.organization_id,old.id,old.referencia) then
    raise exception 'Este movimiento pertenece a una venta, compra o anulación. Corrige la operación de origen para conservar Caja y stock.';
  end if;
  return old;
end $$;
create trigger trg_proteger_borrado_kardex before delete on public.inventario_movimientos
for each row execute function public.proteger_borrado_kardex();

create or replace function public.eliminar_movimiento_inventario_seguro(p_org uuid,p_actor uuid,p_id uuid)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_mov public.inventario_movimientos%rowtype; v_stock numeric; v_delta numeric;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','almacen','ventas']);
  select * into v_mov from public.inventario_movimientos where organization_id=p_org and id=p_id for update;
  if not found then raise exception 'Movimiento no encontrado.'; end if;
  if public.movimiento_inventario_vinculado(p_org,p_id,v_mov.referencia) then
    raise exception 'Este movimiento pertenece a una venta, compra o anulación. Corrige la operación de origen para conservar Caja y stock.';
  end if;
  select stock_actual into v_stock from public.inventario_productos where organization_id=p_org and id=v_mov.producto_id for no key update;
  if not found then raise exception 'Producto no encontrado.'; end if;
  v_delta:=case when v_mov.tipo='salida_venta' then v_mov.cantidad else -v_mov.cantidad end;
  if v_stock+v_delta<0 then raise exception 'No se puede eliminar: parte de esta entrada ya se utilizó. Revisa el stock.'; end if;
  update public.inventario_productos set stock_actual=stock_actual+v_delta where organization_id=p_org and id=v_mov.producto_id;
  delete from public.inventario_movimientos where organization_id=p_org and id=p_id;
end $$;

create or replace function public.eliminar_producto_inventario_seguro(p_org uuid,p_actor uuid,p_id uuid,p_forzar boolean)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','almacen','ventas']);
  perform 1 from public.inventario_productos where organization_id=p_org and id=p_id for update;
  if not found then raise exception 'Producto no encontrado.'; end if;
  if not p_forzar and exists(select 1 from public.inventario_movimientos where organization_id=p_org and producto_id=p_id) then
    raise exception '[INV_KARDEX_BLOCK] Este producto tiene movimientos en Kardex. Revisa los movimientos manuales o desactiva el producto.';
  end if;
  if p_forzar then delete from public.inventario_movimientos where organization_id=p_org and producto_id=p_id; end if;
  delete from public.inventario_productos where organization_id=p_org and id=p_id;
end $$;

create or replace function public.editar_producto_inventario_seguro(p_org uuid,p_actor uuid,p_id uuid,p_datos jsonb,p_stock_esperado numeric)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_row public.inventario_productos%rowtype; v_stock numeric;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','almacen','ventas']);
  select * into v_row from public.inventario_productos where organization_id=p_org and id=p_id for no key update;
  if not found then raise exception 'Producto no encontrado.'; end if;
  v_stock:=v_row.stock_actual;
  if p_datos ? 'stock_actual' then
    if p_stock_esperado is null then raise exception 'Vuelve a abrir el producto antes de modificar su stock.'; end if;
    if (p_datos->>'stock_actual')::numeric<>p_stock_esperado then
      if v_stock<>p_stock_esperado then raise exception 'El stock cambió mientras editabas. Actualiza antes de modificarlo.'; end if;
      v_stock:=(p_datos->>'stock_actual')::numeric;
      if v_stock is null or v_stock<0 then raise exception 'Stock inválido.'; end if;
    end if;
  end if;
  update public.inventario_productos set codigo=p_datos->>'codigo',nombre=p_datos->>'nombre',categoria=p_datos->>'categoria',
    unidad=p_datos->>'unidad',stock_minimo=(p_datos->>'stock_minimo')::numeric,stock_actual=v_stock,
    foto_url=p_datos->>'foto_url',costo_unitario=(p_datos->>'costo_unitario')::numeric where organization_id=p_org and id=p_id;
end $$;

create or replace function public.registrar_conteo_inventario_seguro(p_org uuid,p_actor uuid,p_producto uuid,p_fecha date,
  p_contado numeric,p_referencia text,p_stock_esperado numeric)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_stock numeric; v_diferencia numeric;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','almacen','ventas']);
  select stock_actual into v_stock from public.inventario_productos where organization_id=p_org and id=p_producto for no key update;
  if not found then raise exception 'Producto no encontrado.'; end if;
  if p_contado is null or p_contado<0 then raise exception 'Conteo inválido.'; end if;
  if p_stock_esperado is null or v_stock<>p_stock_esperado then raise exception 'El stock cambió. Actualiza y comprueba el conteo antes de guardarlo.'; end if;
  v_diferencia:=round(p_contado-v_stock,2);
  if v_diferencia<>0 then
    insert into public.inventario_movimientos(organization_id,producto_id,fecha,tipo,cantidad,referencia)
    values(p_org,p_producto,p_fecha,'ajuste',v_diferencia,p_referencia);
  end if;
end $$;

create or replace function public.editar_cotizacion_unificada_segura(p_org uuid,p_actor uuid,p_id uuid,p_datos jsonb,p_total_esperado numeric,p_estado_esperado text)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_cot public.cotizaciones_unificadas%rowtype; v_total numeric; v_cobrado numeric;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','ventas']);
  select * into v_cot from public.cotizaciones_unificadas where organization_id=p_org and id=p_id and deleted_at is null for update;
  if not found or v_cot.estado_flujo='cobrada' or v_cot.total is distinct from p_total_esperado or v_cot.estado_flujo::text is distinct from p_estado_esperado then
    raise exception 'La cotización cambió o ya está cobrada. Actualiza antes de guardar.';
  end if;
  v_total:=(p_datos->>'total')::numeric;
  v_cobrado:=public.cobrado_cotizacion(p_org,p_id,true);
  if v_total is null or v_total<0 or v_cobrado<0 or round(v_total,2)<round(v_cobrado,2) then
    raise exception 'El total no puede ser inferior al dinero ya recibido. Revisa los cobros antes de guardar.';
  end if;
  perform 1 from public.clientes where organization_id=p_org and id=(p_datos->>'cliente_id')::uuid;
  if not found then raise exception 'Cliente no encontrado.'; end if;
  update public.cotizaciones_unificadas set cliente_id=(p_datos->>'cliente_id')::uuid,tipo_cliente=p_datos->>'tipo_cliente',
    fecha=(p_datos->>'fecha')::date,total=v_total,estado_flujo=(p_datos->>'estado_flujo')::public.estado_cotizacion_unificada,detalle=p_datos->'detalle'
    where organization_id=p_org and id=p_id;
end $$;

create or replace function public.registrar_servicio_integral(p_org uuid,p_actor uuid,p_tipo text,p_clave uuid,p_documento jsonb,p_caja jsonb,p_provisional boolean)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_firma text; v_previa public.operaciones_financieras_seguras%rowtype; v_id uuid; v_cliente uuid; v_fila jsonb; v_fecha date;
  v_cols text; v_values text; v_tabla text; v_modulo text;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','ventas']);
  if p_tipo not in ('aserradero','alquiler') or p_clave is null or (p_provisional and p_tipo<>'aserradero') then raise exception 'Solicitud inválida.'; end if;
  v_firma:=md5(jsonb_build_object('documento',p_documento-array['correlativo','codigo'],'caja',p_caja,'provisional',p_provisional)::text);
  select * into v_previa from public.operaciones_financieras_seguras where id=p_clave;
  if found then
    if v_previa.organization_id<>p_org or v_previa.tipo<>p_tipo or v_previa.firma<>v_firma then
      raise exception 'Esta solicitud ya se guardó con otros datos. Abre un formulario nuevo.';
    end if;
    return v_previa.resultado_id;
  end if;
  v_fecha:=coalesce((p_documento->>'fecha')::date,(p_documento->>'fecha_inicio')::date);
  perform public.comprobar_periodo_abierto(p_org,v_fecha);
  if p_provisional then
    if p_caja->>'tipo_comprobante'='factura' then raise exception 'Completa un cliente con RUC valido antes de emitir factura.'; end if;
    v_cliente:=gen_random_uuid();
    insert into public.clientes(id,organization_id,nombre,documento) values(v_cliente,p_org,'Cliente pendiente','PEND-'||p_clave::text);
  else
    v_cliente:=(p_documento->>'cliente_id')::uuid;
    perform 1 from public.clientes where organization_id=p_org and id=v_cliente for key share;
    if not found then raise exception 'Cliente no encontrado en esta empresa.'; end if;
  end if;
  v_tabla:=case p_tipo when 'aserradero' then 'servicios_aserradero' else 'alquileres' end;
  v_modulo:=case p_tipo when 'aserradero' then 'ventas_aserradero' else 'ventas_alquiler' end;
  v_fila:=p_documento||jsonb_build_object('id',p_clave,'organization_id',p_org,'cliente_id',v_cliente);
  if p_tipo='aserradero' then v_fila:=v_fila||jsonb_build_object('created_by',p_actor); end if;
  select string_agg(format('%I',key),',' order by key),string_agg(format('r.%I',key),',' order by key)
    into v_cols,v_values from jsonb_object_keys(v_fila) key;
  execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1) r returning id',v_tabla,v_cols,v_values,v_tabla) into v_id using v_fila;
  if p_caja is not null and p_caja<>'null'::jsonb then
    perform public.insertar_fila_operacion('movimientos_caja',p_caja||jsonb_build_object('organization_id',p_org,'referencia_id',v_id,'modulo_origen',v_modulo,'created_by',p_actor,'updated_by',p_actor));
  end if;
  insert into public.operaciones_financieras_seguras(id,organization_id,tipo,firma,resultado_id) values(p_clave,p_org,p_tipo,v_firma,v_id);
  return v_id;
end $$;

revoke all on function public.movimiento_inventario_vinculado(uuid,uuid,text),public.eliminar_movimiento_inventario_seguro(uuid,uuid,uuid),
 public.eliminar_producto_inventario_seguro(uuid,uuid,uuid,boolean),public.editar_producto_inventario_seguro(uuid,uuid,uuid,jsonb,numeric),
 public.registrar_conteo_inventario_seguro(uuid,uuid,uuid,date,numeric,text,numeric),public.editar_cotizacion_unificada_segura(uuid,uuid,uuid,jsonb,numeric,text),
 public.registrar_servicio_integral(uuid,uuid,text,uuid,jsonb,jsonb,boolean),public.proteger_borrado_kardex() from public,anon,authenticated;
grant execute on function public.movimiento_inventario_vinculado(uuid,uuid,text),public.eliminar_movimiento_inventario_seguro(uuid,uuid,uuid),
 public.eliminar_producto_inventario_seguro(uuid,uuid,uuid,boolean),public.editar_producto_inventario_seguro(uuid,uuid,uuid,jsonb,numeric),
 public.registrar_conteo_inventario_seguro(uuid,uuid,uuid,date,numeric,text,numeric),public.editar_cotizacion_unificada_segura(uuid,uuid,uuid,jsonb,numeric,text),
 public.registrar_servicio_integral(uuid,uuid,text,uuid,jsonb,jsonb,boolean),public.proteger_borrado_kardex() to service_role;

-- La corrección histórica se redefine al final conservando sus cálculos.

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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solo Katia puede corregir comprobantes históricos.';
  END IF;

  PERFORM public.comprobar_autor_financiero(v_actor.organization_id,p_actor_id,array['owner_admin']);

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

  IF v_venta.modalidad_pago IS DISTINCT FROM 'contado' AND
    (SELECT COALESCE(sum(CASE WHEN tipo::text='ingreso' THEN monto WHEN tipo::text='egreso' THEN -monto ELSE 0 END),0)
     FROM public.movimientos_caja WHERE organization_id=v_venta.organization_id AND referencia_id=v_venta.id
       AND modulo_origen='ventas_madera_cortada' AND voided_at IS NULL AND deleted_at IS NULL) > round(p_total,2) THEN
    RAISE EXCEPTION 'El total no puede ser inferior al dinero ya recibido. Revisa los cobros.';
  END IF;

  IF round(v_venta.total, 2) <> round(p_total, 2) AND v_venta.modalidad_pago = 'contado' THEN
    SELECT count(*) INTO v_caja_count
    FROM public.movimientos_caja
    WHERE organization_id = v_venta.organization_id
      AND referencia_id = v_venta.id
      AND modulo_origen = 'ventas_madera_cortada'
      AND voided_at IS NULL AND deleted_at IS NULL;

    IF NOT p_sincronizar_caja OR v_caja_count <> 1 THEN
      RAISE EXCEPTION 'El total cambia y caja no tiene un único movimiento activo. Revisa caja antes de continuar.';
    END IF;

    SELECT * INTO v_caja
    FROM public.movimientos_caja
    WHERE organization_id = v_venta.organization_id
      AND referencia_id = v_venta.id
      AND modulo_origen = 'ventas_madera_cortada'
      AND voided_at IS NULL AND deleted_at IS NULL
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

create or replace function public.crear_compra_madera_con_caja(p_org uuid,p_actor uuid,p_compra jsonb)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','almacen','ventas']);
  raise exception 'La compra antigua de madera no está disponible. Usa la compra de inventario.';
end $$;

commit;

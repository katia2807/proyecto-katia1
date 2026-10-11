-- Corrige operaciones nuevas. No reconcilia ni reescribe datos históricos.
begin;

create table public.operaciones_financieras_seguras (
  id uuid primary key, organization_id uuid not null, tipo text not null,
  firma text not null, resultado_id uuid not null, created_at timestamptz not null default now()
);
alter table public.operaciones_financieras_seguras enable row level security;
revoke all on public.operaciones_financieras_seguras from public,anon,authenticated;
grant all on public.operaciones_financieras_seguras to service_role;

-- Un cierre y sus escrituras comparten el mismo bloqueo de empresa.
create or replace function public.bloquear_operacion_empresa(p_org uuid)
returns void language sql security invoker set search_path=pg_catalog,public as $$
  select pg_advisory_xact_lock(hashtextextended('katia-finanzas:'||p_org::text,0));
$$;
create or replace function public.comprobar_periodo_abierto(p_org uuid,p_fecha date)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  perform public.bloquear_operacion_empresa(p_org);
  if exists(select 1 from public.cierres_mensuales where organization_id=p_org
    and anio=extract(year from p_fecha)::int and mes=extract(month from p_fecha)::int and reopened_at is null) then
    raise exception 'La fecha pertenece a un período cerrado. No se guardó la operación.';
  end if;
end $$;

create or replace function public.prevent_closed_period_changes()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if tg_op='INSERT' then
    perform public.comprobar_periodo_abierto(new.organization_id,new.fecha);
    return new;
  end if;
  perform public.bloquear_operacion_empresa(old.organization_id);
  if old.periodo_cerrado then raise exception 'Este registro pertenece a un período cerrado. No se puede editar ni eliminar.'; end if;
  if tg_op='DELETE' then
    perform public.comprobar_periodo_abierto(old.organization_id,old.fecha);
    return old;
  end if;
  if new.organization_id is distinct from old.organization_id then raise exception 'No se puede cambiar la empresa de un movimiento.'; end if;
  -- cerrar_mes solo añade la marca; no modifica importes ni fechas del cierre.
  if new.periodo_cerrado and not old.periodo_cerrado
    and (to_jsonb(new)-array['periodo_cerrado','updated_at','updated_by'])=(to_jsonb(old)-array['periodo_cerrado','updated_at','updated_by']) then
    return new;
  end if;
  perform public.comprobar_periodo_abierto(old.organization_id,old.fecha);
  perform public.comprobar_periodo_abierto(new.organization_id,new.fecha);
  return new;
end $$;
drop trigger if exists trg_movimientos_caja_prevent_update on public.movimientos_caja;
create trigger trg_movimientos_caja_prevent_update before insert or update or delete on public.movimientos_caja
for each row execute function public.prevent_closed_period_changes();

create or replace function public.sync_stock_from_movimiento()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_stock numeric; v_delta numeric;
begin
  perform public.bloquear_operacion_empresa(new.organization_id);
  select stock_actual into v_stock from public.inventario_productos
    where id=new.producto_id and organization_id=new.organization_id for no key update;
  if not found then raise exception 'Producto de inventario no encontrado en esta empresa'; end if;
  v_delta:=case when new.tipo='salida_venta' then -new.cantidad else new.cantidad end;
  if v_stock+v_delta<0 then raise exception 'Stock insuficiente. Actualiza las existencias antes de registrar.'; end if;
  update public.inventario_productos set stock_actual=stock_actual+v_delta
    where id=new.producto_id and organization_id=new.organization_id;
  return new;
end $$;

-- Inserta únicamente las columnas provistas: conserva los defaults del esquema real.
-- Helper interno, restringido al servidor y a una lista cerrada de tablas.
create or replace function public.insertar_fila_operacion(p_tabla text,p_fila jsonb)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_cols text; v_values text; v_id uuid;
begin
  if p_tabla not in ('ventas_madera','ventas_madera_lineas','ventas_mueble_terminado','ventas_madera_cortada',
    'inventario_movimientos','movimientos_caja') then raise exception 'Tabla de operación inválida'; end if;
  select string_agg(format('%I',key),',' order by key),string_agg(format('r.%I',key),',' order by key)
    into v_cols,v_values from jsonb_object_keys(p_fila) key;
  if p_tabla='ventas_madera_lineas' then
    execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1) r',p_tabla,v_cols,v_values,p_tabla) using p_fila;
    return null;
  end if;
  execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1) r returning id',p_tabla,v_cols,v_values,p_tabla)
    into v_id using p_fila;
  return v_id;
end $$;

create or replace function public.registrar_operacion_integral(p_org uuid,p_actor uuid,p_tipo text,p_clave uuid,
  p_documento jsonb,p_lineas jsonb,p_stock jsonb,p_caja jsonb)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_tabla text; v_modulo text; v_id uuid; v_item jsonb; v_firma text; v_previa public.operaciones_financieras_seguras%rowtype;
  v_cantidad numeric; v_stock numeric;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,case when p_tipo='compra_inventario'
    then array['owner_admin','gerencia','almacen','ventas'] else array['owner_admin','gerencia','ventas'] end);
  perform public.bloquear_operacion_empresa(p_org);
  if p_clave is null then raise exception 'Identificador de solicitud requerido'; end if;
  v_firma:=md5(jsonb_build_object('documento',p_documento-array['id','correlativo'],'lineas',p_lineas,'stock',p_stock,'caja',p_caja)::text);
  select * into v_previa from public.operaciones_financieras_seguras where id=p_clave;
  if found then
    if v_previa.organization_id<>p_org or v_previa.tipo<>p_tipo or v_previa.firma<>v_firma then
      raise exception 'Esta solicitud ya se guardó con otros datos. Abre un formulario nuevo.';
    end if;
    return v_previa.resultado_id;
  end if;
  if p_tipo not in ('compra_inventario','venta_madera','venta_mueble','venta_madera_cortada') then raise exception 'Tipo de operación inválido'; end if;
  if jsonb_typeof(p_stock)<>'array' or jsonb_typeof(p_lineas)<>'array' then raise exception 'Detalle inválido'; end if;
  if p_tipo<>'compra_inventario' then
    perform 1 from public.clientes where id=(p_documento->>'cliente_id')::uuid and organization_id=p_org for key share;
    if not found then raise exception 'Cliente no encontrado en esta empresa'; end if;
  end if;
  perform public.comprobar_periodo_abierto(p_org,(p_documento->>'fecha')::date);
  -- Orden fijo de bloqueos y validación final dentro de la transacción.
  for v_item in select value from jsonb_array_elements(p_stock) order by value->>'producto_id' loop
    select stock_actual into v_stock from public.inventario_productos where id=(v_item->>'producto_id')::uuid and organization_id=p_org for no key update;
    if not found then raise exception 'Producto de inventario no encontrado'; end if;
    v_cantidad:=(v_item->>'cantidad')::numeric;
    if v_cantidad is null or v_cantidad<=0 then raise exception 'Cantidad de inventario inválida'; end if;
    if p_tipo<>'compra_inventario' and v_cantidad>v_stock then raise exception 'Stock insuficiente. Actualiza las existencias antes de registrar.'; end if;
  end loop;
  if p_tipo='venta_mueble' then
    perform 1 from public.inventario_productos where id=(p_documento->>'mueble_catalogo_id')::uuid and organization_id=p_org for update;
    if not found then raise exception 'Inventario del mueble no encontrado'; end if;
    select stock_disponible into v_stock from public.muebles_catalogo where id=(p_documento->>'mueble_catalogo_id')::uuid and organization_id=p_org for update;
    v_cantidad:=(p_documento->>'cantidad')::numeric;
    if not found or v_cantidad is null or v_cantidad<=0 or v_cantidad>v_stock then raise exception 'Stock insuficiente para esta venta'; end if;
    if (select stock_actual from public.inventario_productos where id=(p_documento->>'mueble_catalogo_id')::uuid and organization_id=p_org)<v_cantidad then
      raise exception 'Stock insuficiente en Inventario para este mueble';
    end if;
  end if;
  if p_tipo='compra_inventario' then
    if jsonb_array_length(p_stock)<>1 then raise exception 'La compra requiere un producto'; end if;
    v_item:=p_stock->0;
    v_id:=public.insertar_fila_operacion('inventario_movimientos',v_item||jsonb_build_object('id',p_clave,'organization_id',p_org,'fecha',p_documento->>'fecha','tipo','entrada_compra'));
    v_modulo:='inventario';
    if p_caja is not null and p_caja<>'null'::jsonb then
      p_caja:=p_caja||jsonb_build_object('descripcion','Compra de inventario: '||
        (select nombre from public.inventario_productos where id=(v_item->>'producto_id')::uuid and organization_id=p_org));
    end if;
  else
    v_tabla:=case p_tipo when 'venta_madera' then 'ventas_madera' when 'venta_mueble' then 'ventas_mueble_terminado' else 'ventas_madera_cortada' end;
    v_modulo:=case p_tipo when 'venta_madera' then 'ventas_madera' when 'venta_mueble' then 'ventas_muebles_terminados' else 'ventas_madera_cortada' end;
    v_id:=public.insertar_fila_operacion(v_tabla,p_documento||jsonb_build_object('id',p_clave,'organization_id',p_org,'created_by',p_actor));
    if p_tipo='venta_madera' then
      for v_item in select value from jsonb_array_elements(p_lineas) loop
        perform public.insertar_fila_operacion('ventas_madera_lineas',v_item||jsonb_build_object('venta_id',v_id));
      end loop;
    end if;
    for v_item in select value from jsonb_array_elements(p_stock) loop
      perform public.insertar_fila_operacion('inventario_movimientos',v_item||jsonb_build_object('organization_id',p_org,
        'fecha',p_documento->>'fecha','tipo','salida_venta','referencia',case p_tipo when 'venta_madera' then 'venta:' else 'venta_madera_cortada:' end||v_id::text));
    end loop;
  end if;
  if p_caja is not null and p_caja<>'null'::jsonb then
    perform public.insertar_fila_operacion('movimientos_caja',p_caja||jsonb_build_object('organization_id',p_org,'referencia_id',v_id,
      'modulo_origen',v_modulo,'created_by',p_actor,'updated_by',p_actor));
  end if;
  insert into public.operaciones_financieras_seguras(id,organization_id,tipo,firma,resultado_id) values(p_clave,p_org,p_tipo,v_firma,v_id);
  return v_id;
end $$;

create or replace function public.anular_operacion_integral(p_org uuid,p_actor uuid,p_tipo text,p_id uuid)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_tabla text; v_modulos text[]; v_documento jsonb; v_item record; v_firma text; v_categoria text;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,case when p_tipo='venta_mueble' then array['owner_admin'] else array['owner_admin','gerencia','ventas'] end);
  perform public.bloquear_operacion_empresa(p_org);
  v_tabla:=case p_tipo when 'venta_mueble' then 'ventas_mueble_terminado' when 'venta_madera' then 'ventas_madera'
    when 'venta_madera_cortada' then 'ventas_madera_cortada' when 'aserradero' then 'servicios_aserradero' when 'alquiler' then 'alquileres' end;
  if v_tabla is null then raise exception 'Tipo de anulación inválido'; end if;
  v_modulos:=case p_tipo when 'venta_mueble' then array['ventas_muebles_terminados'] when 'venta_madera' then array['ventas_madera']
    when 'venta_madera_cortada' then array['ventas_madera_cortada'] when 'aserradero' then array['ventas_aserradero','aserradero'] else array['ventas_alquiler','alquiler'] end;
  execute format('select to_jsonb(t) from public.%I t where id=$1 and organization_id=$2 for update',v_tabla) into v_documento using p_id,p_org;
  if v_documento is null then
    if exists(select 1 from public.operaciones_financieras_seguras where organization_id=p_org and tipo='anular_'||p_tipo and resultado_id=p_id) then return; end if;
    raise exception 'No se encontró la operación';
  end if;
  perform public.comprobar_periodo_abierto(p_org,coalesce((v_documento->>'fecha')::date,(v_documento->>'fecha_inicio')::date));
  perform 1 from public.movimientos_caja where organization_id=p_org and referencia_id=p_id and modulo_origen=any(v_modulos) for update;
  if exists(select 1 from public.movimientos_caja where organization_id=p_org and referencia_id=p_id and modulo_origen=any(v_modulos)
    and periodo_cerrado and voided_at is null and deleted_at is null) then raise exception 'El cobro pertenece a un período cerrado'; end if;
  update public.movimientos_caja set voided_at=now(),void_reason='Operación anulada desde su registro'
    where organization_id=p_org and referencia_id=p_id and modulo_origen=any(v_modulos) and voided_at is null and deleted_at is null;
  if p_tipo='venta_mueble' then
    -- Únicamente el Kardex devuelve la cantidad; reflejar su resultado en el catálogo.
    perform public.insertar_fila_operacion('inventario_movimientos',jsonb_build_object('organization_id',p_org,
      'producto_id',v_documento->>'mueble_catalogo_id','fecha',(current_timestamp at time zone 'America/Lima')::date,'tipo','ajuste',
      'cantidad',v_documento->'cantidad','referencia','anulacion:venta_mueble:'||p_id::text));
    -- El trigger heredado evita recursión y no sincroniza desde un trigger anidado.
    update public.muebles_catalogo c set stock_disponible=p.stock_actual
      from public.inventario_productos p where c.id=(v_documento->>'mueble_catalogo_id')::uuid
      and c.organization_id=p_org and p.id=c.id and p.organization_id=p_org;
  elsif p_tipo in ('venta_madera','venta_madera_cortada') then
    for v_item in select * from public.inventario_movimientos where organization_id=p_org and tipo='salida_venta'
      and referencia=(case p_tipo when 'venta_madera' then 'venta:' else 'venta_madera_cortada:' end)||p_id::text order by producto_id loop
      perform public.insertar_fila_operacion('inventario_movimientos',jsonb_build_object('organization_id',p_org,'producto_id',v_item.producto_id,
        'fecha',(current_timestamp at time zone 'America/Lima')::date,'tipo','ajuste','cantidad',v_item.cantidad,'costo_unitario',v_item.costo_unitario,'referencia','anulacion:'||p_tipo||':'||p_id::text));
    end loop;
  end if;
  if p_tipo='venta_madera' then delete from public.ventas_madera_lineas where venta_id=p_id; end if;
  execute format('delete from public.%I where id=$1 and organization_id=$2',v_tabla) using p_id,p_org;
  insert into public.operaciones_financieras_seguras(id,organization_id,tipo,firma,resultado_id)
    values(gen_random_uuid(),p_org,'anular_'||p_tipo,md5(v_documento::text),p_id);
end $$;

-- Bloquea el camino antiguo que devolvía stock dos veces y no anulaba el cobro.
create or replace function public.cancelar_venta_mueble(p_venta_id uuid,p_org_id uuid default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin raise exception 'La anulación requiere la actualización de operaciones del programa.'; end $$;
revoke all on function public.cancelar_venta_mueble(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.editar_alquiler_integral(p_org uuid,p_actor uuid,p_id uuid,p_documento jsonb,p_monto numeric,p_medio text,p_descripcion text)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_contrato public.alquileres%rowtype; v_caja public.movimientos_caja%rowtype; v_cuenta int;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','almacen','ventas']);
  perform public.bloquear_operacion_empresa(p_org);
  select * into v_contrato from public.alquileres where id=p_id and organization_id=p_org for update;
  if not found then raise exception 'Contrato no encontrado'; end if;
  if v_contrato.estado='cerrado' then raise exception 'El contrato ya está cerrado y no se puede modificar'; end if;
  perform public.comprobar_periodo_abierto(p_org,v_contrato.fecha_inicio);
  perform public.comprobar_periodo_abierto(p_org,(p_documento->>'fecha_inicio')::date);
  if not exists(select 1 from public.clientes where id=(p_documento->>'cliente_id')::uuid and organization_id=p_org) then raise exception 'Cliente no encontrado'; end if;
  perform 1 from public.movimientos_caja where organization_id=p_org and referencia_id=p_id and modulo_origen in ('ventas_alquiler','alquiler') for update;
  select count(*) into v_cuenta from public.movimientos_caja where organization_id=p_org and referencia_id=p_id
    and modulo_origen in ('ventas_alquiler','alquiler') and voided_at is null and deleted_at is null;
  if v_cuenta>1 then raise exception 'Revisa los cobros vinculados al contrato antes de editar'; end if;
  select * into v_caja from public.movimientos_caja where organization_id=p_org and referencia_id=p_id
    and modulo_origen in ('ventas_alquiler','alquiler') and voided_at is null and deleted_at is null;
  if v_caja.periodo_cerrado then raise exception 'El cobro pertenece a un período cerrado'; end if;
  update public.alquileres set cliente_id=(p_documento->>'cliente_id')::uuid,activo=p_documento->>'activo',
    fecha_inicio=(p_documento->>'fecha_inicio')::date,fecha_termino=(p_documento->>'fecha_termino')::date,
    tarifa=(p_documento->>'tarifa')::numeric,representante=p_documento->>'representante',ruc_empresa=p_documento->>'ruc_empresa',
    direccion_ejecucion=p_documento->>'direccion_ejecucion',dias_alquiler=(p_documento->>'dias_alquiler')::int,
    tarifa_unidad=p_documento->>'tarifa_unidad',monto_total=(p_documento->>'monto_total')::numeric,deposito_30=p_monto,
    penalidad_retraso_pago_pct=(p_documento->>'penalidad_retraso_pago_pct')::numeric,
    penalidad_devolucion_tardia_pct=(p_documento->>'penalidad_devolucion_tardia_pct')::numeric,
    penalidad_danios_pct=(p_documento->>'penalidad_danios_pct')::numeric,metodo_pago=p_documento->>'metodo_pago',
    modalidad_pago=p_documento->>'modalidad_pago',fecha_pago_credito=(p_documento->>'fecha_pago_credito')::date where id=p_id and organization_id=p_org;
  if v_caja.id is not null and p_monto>0 then
    update public.movimientos_caja set fecha=(p_documento->>'fecha_inicio')::date,monto=p_monto,medio=p_medio::public.medio_pago,descripcion=p_descripcion
      where id=v_caja.id and organization_id=p_org;
  elsif v_caja.id is not null then
    update public.movimientos_caja set voided_at=now(),void_reason='El contrato cambió a crédito' where id=v_caja.id and organization_id=p_org;
  elsif p_monto>0 then
    perform public.insertar_fila_operacion('movimientos_caja',jsonb_build_object('organization_id',p_org,'fecha',p_documento->>'fecha_inicio',
      'tipo','ingreso','medio',p_medio,'categoria','alquiler_bomba_mixer','monto',p_monto,'descripcion',p_descripcion,
      'modulo_origen','ventas_alquiler','referencia_id',p_id,'created_by',p_actor,'updated_by',p_actor));
  end if;
end $$;

create or replace function public.eliminar_cliente_integral(p_org uuid,p_actor uuid,p_id uuid)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_item record; v_tabla text; v_tipo text; v_refs uuid[];
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin']);
  perform public.bloquear_operacion_empresa(p_org);
  perform 1 from public.clientes where id=p_id and organization_id=p_org for update;
  if not found then raise exception 'Cliente no encontrado'; end if;
  select array_agg(id) into v_refs from (
    select id from public.ordenes_produccion where organization_id=p_org and cliente_id=p_id
    union all select id from public.cotizaciones_unificadas where organization_id=p_org and cliente_id=p_id
    union all select id from public.cotizaciones_mueble where organization_id=p_org and cliente_id=p_id
  ) d;
  update public.movimientos_caja set voided_at=now(),void_reason='Cliente y operaciones eliminados'
    where organization_id=p_org and referencia_id=any(v_refs) and modulo_origen in ('ventas','cotizacion_unificada','muebles_corte')
      and voided_at is null and deleted_at is null;
  for v_tipo,v_tabla in select * from (values('venta_mueble','ventas_mueble_terminado'),('venta_madera','ventas_madera'),
    ('venta_madera_cortada','ventas_madera_cortada'),('aserradero','servicios_aserradero'),('alquiler','alquileres')) t(tipo,tabla) loop
    for v_item in execute format('select id from public.%I where organization_id=$1 and cliente_id=$2 order by id',v_tabla) using p_org,p_id loop
      perform public.anular_operacion_integral(p_org,p_actor,v_tipo,v_item.id);
    end loop;
  end loop;
  delete from public.ordenes_produccion where organization_id=p_org and cliente_id=p_id;
  delete from public.cotizaciones_unificadas where organization_id=p_org and cliente_id=p_id;
  delete from public.cotizaciones_mueble where organization_id=p_org and cliente_id=p_id;
  delete from public.clientes where organization_id=p_org and id=p_id;
end $$;

-- Todos los RPC nuevos permanecen exclusivamente en el servidor.
revoke all on function public.bloquear_operacion_empresa(uuid),public.comprobar_periodo_abierto(uuid,date),
  public.insertar_fila_operacion(text,jsonb),public.registrar_operacion_integral(uuid,uuid,text,uuid,jsonb,jsonb,jsonb,jsonb),
  public.anular_operacion_integral(uuid,uuid,text,uuid),public.editar_alquiler_integral(uuid,uuid,uuid,jsonb,numeric,text,text),
  public.eliminar_cliente_integral(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.bloquear_operacion_empresa(uuid),public.comprobar_periodo_abierto(uuid,date),
  public.insertar_fila_operacion(text,jsonb),public.registrar_operacion_integral(uuid,uuid,text,uuid,jsonb,jsonb,jsonb,jsonb),
  public.anular_operacion_integral(uuid,uuid,text,uuid),public.editar_alquiler_integral(uuid,uuid,uuid,jsonb,numeric,text,text),
  public.eliminar_cliente_integral(uuid,uuid,uuid) to service_role;

CREATE OR REPLACE FUNCTION public.cerrar_mes(p_org_id uuid, p_anio integer, p_mes integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  reporte jsonb;
  hash_val text;
begin
  perform public.bloquear_operacion_empresa(p_org_id);
  if app.current_role() not in ('owner_admin', 'gerencia') then
    raise exception 'No tienes permisos para cerrar mes.';
  end if;

  if exists (
    select 1 from cierres_mensuales
    where organization_id = p_org_id and anio = p_anio and mes = p_mes and reopened_at is null
  ) then
    raise exception 'El período ya está cerrado.';
  end if;

  select to_jsonb(u)
  into reporte
  from (
    select * from utilidad_mensual
    where organization_id = p_org_id and anio = p_anio and mes = p_mes
  ) as u;

  hash_val := encode(digest(coalesce(reporte::text, '{}'), 'sha256'), 'hex');

  insert into cierres_mensuales (organization_id, anio, mes, reporte_json, hash_sha256, closed_by)
  values (p_org_id, p_anio, p_mes, coalesce(reporte, '{}'::jsonb), hash_val, auth.uid())
  on conflict (organization_id, anio, mes)
  do update set
    reporte_json = excluded.reporte_json,
    hash_sha256 = excluded.hash_sha256,
    closed_at = now(),
    closed_by = auth.uid(),
    reopened_at = null,
    reopened_by = null,
    reopen_reason = null;

  update movimientos_caja
  set periodo_cerrado = true
  where organization_id = p_org_id
    and extract(year from fecha)::int = p_anio
    and extract(month from fecha)::int = p_mes;

  perform log_audit_event(
    p_org_id,
    'MONTH_CLOSE',
    'cierres_mensuales',
    (select id from cierres_mensuales where organization_id = p_org_id and anio = p_anio and mes = p_mes),
    jsonb_build_object('anio', p_anio, 'mes', p_mes, 'hash', hash_val)
  );

  return hash_val;
end;
$function$
;

commit;

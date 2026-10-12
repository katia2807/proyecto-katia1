-- Protege operaciones nuevas; no reconcilia cotizaciones, clientes ni Caja históricos.
begin;

create or replace function public.registrar_cotizacion_unificada_segura(p_org uuid,p_actor uuid,p_clave uuid,p_datos jsonb)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_previa public.operaciones_financieras_seguras%rowtype; v_firma text; v_id uuid;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','ventas']);
  perform public.bloquear_operacion_empresa(p_org);
  if p_clave is null or p_datos is null or jsonb_typeof(p_datos)<>'object'
    or coalesce(p_datos->>'estado_flujo','') not in ('pendiente','lista_produccion')
    or coalesce(p_datos->>'tipo_cliente','') not in ('natural','empresa')
    or p_datos->>'fecha' is null or jsonb_typeof(p_datos->'detalle') is distinct from 'object'
    or (p_datos->>'total')::numeric is null or (p_datos->>'total')::numeric<0 then
    raise exception 'Datos de cotización inválidos. El alta no puede registrar un cobro.';
  end if;
  v_firma:=md5((p_datos-'correlativo')::text);
  select * into v_previa from public.operaciones_financieras_seguras where id=p_clave;
  if found then
    if v_previa.organization_id<>p_org or v_previa.tipo<>'cotizacion_unificada' or v_previa.firma<>v_firma then
      raise exception 'Esta solicitud ya se guardó con otros datos. Revisa el historial antes de abrir una nueva.';
    end if;
    if not exists(select 1 from public.cotizaciones_unificadas where id=v_previa.resultado_id and organization_id=p_org and deleted_at is null) then
      raise exception 'La cotización de este envío ya fue eliminada. Abre una nueva.';
    end if;
    return v_previa.resultado_id;
  end if;
  if not exists(select 1 from public.clientes where id=(p_datos->>'cliente_id')::uuid and organization_id=p_org) then
    raise exception 'Cliente no encontrado en esta empresa.';
  end if;
  insert into public.cotizaciones_unificadas(id,organization_id,cliente_id,tipo_cliente,fecha,correlativo,total,estado_flujo,detalle)
  values(p_clave,p_org,(p_datos->>'cliente_id')::uuid,p_datos->>'tipo_cliente',(p_datos->>'fecha')::date,
    p_datos->>'correlativo',(p_datos->>'total')::numeric,(p_datos->>'estado_flujo')::public.estado_cotizacion_unificada,p_datos->'detalle')
    returning id into v_id;
  insert into public.operaciones_financieras_seguras(id,organization_id,tipo,firma,resultado_id)
    values(p_clave,p_org,'cotizacion_unificada',v_firma,v_id);
  return v_id;
end $$;

create or replace function public.editar_cotizacion_unificada_segura(p_org uuid,p_actor uuid,p_id uuid,p_datos jsonb,p_total_esperado numeric,p_estado_esperado text)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_cot public.cotizaciones_unificadas%rowtype; v_total numeric; v_cobrado numeric;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','ventas']);
  perform public.bloquear_operacion_empresa(p_org);
  select * into v_cot from public.cotizaciones_unificadas where organization_id=p_org and id=p_id and deleted_at is null for update;
  if not found or v_cot.estado_flujo='cobrada' or v_cot.total is distinct from p_total_esperado or v_cot.estado_flujo::text is distinct from p_estado_esperado then
    raise exception 'La cotización cambió o ya está cobrada. Actualiza antes de guardar.';
  end if;
  if v_cot.cliente_id is distinct from (p_datos->>'cliente_id')::uuid and (
    exists(select 1 from public.ordenes_produccion where organization_id=p_org and cotizacion_unificada_id=p_id)
    or exists(select 1 from public.movimientos_caja where organization_id=p_org and referencia_id=p_id)
  ) then raise exception 'No se puede cambiar el cliente: la cotización tiene una orden o movimientos en Caja vinculados.'; end if;
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

create or replace function public.aprobar_cotizacion_con_adelanto(p_org uuid,p_actor uuid,p_cot uuid,p_unificada boolean,
  p_total_esperado numeric,p_adelanto numeric,p_medio text,p_orden jsonb)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_total numeric; v_cliente uuid; v_estado text; v_id uuid; v_cobrado numeric;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','ventas']);
  perform public.bloquear_operacion_empresa(p_org);
  if p_unificada then
    select total,cliente_id,estado_flujo::text into v_total,v_cliente,v_estado from public.cotizaciones_unificadas
      where id=p_cot and organization_id=p_org and deleted_at is null for update;
  else
    select precio_acordado,cliente_id,estado::text into v_total,v_cliente,v_estado from public.cotizaciones_mueble
      where id=p_cot and organization_id=p_org for update;
  end if;
  if not found then raise exception 'Cotización no encontrada'; end if;
  if (p_unificada and v_estado not in ('lista_produccion','en_produccion','cobrada')) or (not p_unificada and v_estado<>'confirmada') then
    raise exception 'Solo se puede aprobar una cotización aceptada';
  end if;
  if v_total is distinct from p_total_esperado then raise exception 'El total cambió. Actualiza la cotización.'; end if;
  if exists(select 1 from public.ordenes_produccion where organization_id=p_org
    and case when p_unificada then cotizacion_unificada_id=p_cot else cotizacion_id=p_cot end) then
    raise exception 'Esta cotización ya tiene una orden de producción';
  end if;
  v_cobrado:=public.cobrado_cotizacion(p_org,p_cot,p_unificada);
  if p_unificada and v_estado='cobrada' and (v_cobrado<>v_total or p_adelanto is distinct from 0::numeric) then
    raise exception 'La cotización cobrada solo puede generar la orden, con adelanto cero y pago completo verificado.';
  end if;
  if p_adelanto is null or p_adelanto<0 or p_adelanto>v_total-v_cobrado then
    raise exception 'El adelanto no puede superar el saldo de la cotización';
  end if;
  insert into public.ordenes_produccion(organization_id,cliente_id,cotizacion_id,cotizacion_unificada_id,estado,notas,fecha_aprobacion,correlativo,created_by,updated_by)
  values(p_org,v_cliente,case when p_unificada then null else p_cot end,case when p_unificada then p_cot else null end,
    'en_produccion',p_orden->>'notas',(p_orden->>'fecha_aprobacion')::date,p_orden->>'correlativo',p_actor,p_actor) returning id into v_id;
  if p_adelanto>0 then
    insert into public.movimientos_caja(organization_id,fecha,tipo,medio,categoria,monto,descripcion,modulo_origen,referencia_id,created_by,updated_by)
    values(p_org,(p_orden->>'fecha_aprobacion')::date,'ingreso',p_medio::public.medio_pago,'adelanto_mueble_personalizado',p_adelanto,
      'Adelanto al aprobar cotización '||left(p_cot::text,8),'ventas',v_id,p_actor,p_actor);
  end if;
  if p_unificada and v_estado<>'cobrada' then update public.cotizaciones_unificadas set estado_flujo='en_produccion' where id=p_cot and organization_id=p_org; end if;
  return v_id;
end $$;

revoke all on function public.registrar_cotizacion_unificada_segura(uuid,uuid,uuid,jsonb),
  public.editar_cotizacion_unificada_segura(uuid,uuid,uuid,jsonb,numeric,text),
  public.aprobar_cotizacion_con_adelanto(uuid,uuid,uuid,boolean,numeric,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function public.registrar_cotizacion_unificada_segura(uuid,uuid,uuid,jsonb),
  public.editar_cotizacion_unificada_segura(uuid,uuid,uuid,jsonb,numeric,text),
  public.aprobar_cotizacion_con_adelanto(uuid,uuid,uuid,boolean,numeric,numeric,text,jsonb) to service_role;
commit;

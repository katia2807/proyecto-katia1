-- No reescribe cobros históricos. Las operaciones nuevas se guardan completas.
begin;

alter table public.ventas_madera
  add column if not exists metodo_pago text,
  add column if not exists modalidad_pago text,
  add column if not exists adelanto numeric(12,2),
  add column if not exists fecha_pago_credito date;
alter table public.ventas_madera add constraint ventas_madera_pago_valido
  check ((metodo_pago is null or metodo_pago in ('efectivo','yape','transferencia','billetera_digital','otro'))
    and (modalidad_pago is null or modalidad_pago in ('contado','adelanto','credito'))
    and (adelanto is null or (adelanto >= 0 and adelanto <= total))) not valid;
alter table public.servicios_aserradero add constraint aserradero_adelanto_dentro_total
  check (adelanto is null or (adelanto >= 0 and adelanto <= precio_cobrado)) not valid;

create or replace function public.comprobar_autor_financiero(p_org uuid,p_actor uuid,p_roles text[])
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if not exists(select 1 from public.perfiles where organization_id=p_org and user_id=p_actor
    and deactivated_at is null and coalesce(ui_role,role::text)=any(p_roles)) then
    raise exception 'No autorizado para registrar esta operación';
  end if;
end $$;
revoke all on function public.comprobar_autor_financiero(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.comprobar_autor_financiero(uuid,uuid,text[]) to service_role;

create or replace function public.crear_compra_madera_con_caja(p_org uuid,p_actor uuid,p_compra jsonb)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_id uuid; v_compra public.compras_madera%rowtype; v_egreso numeric;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','almacen','ventas']);
  if not exists(select 1 from public.proveedores where id=(p_compra->>'proveedor_id')::uuid and organization_id=p_org) then
    raise exception 'El proveedor no pertenece a esta empresa';
  end if;
  insert into public.compras_madera(organization_id,proveedor_id,fecha,especie_madera,detalle,cantidad,unidad,
    precio_unitario,total,modalidad_pago,adelanto,saldo_pendiente,estado,url_comprobante,created_by)
  values(p_org,(p_compra->>'proveedor_id')::uuid,(p_compra->>'fecha')::date,p_compra->>'especie_madera',p_compra->>'detalle',
    (p_compra->>'cantidad')::numeric,p_compra->>'unidad',(p_compra->>'precio_unitario')::numeric,
    (p_compra->>'total')::numeric,p_compra->>'modalidad_pago',(p_compra->>'adelanto')::numeric,
    (p_compra->>'saldo_pendiente')::numeric,(p_compra->>'estado')::public.estado_documento,p_compra->>'url_comprobante',p_actor)
  returning * into v_compra;
  v_id:=v_compra.id;
  if v_compra.estado::text='confirmada' then
    v_egreso:=case when v_compra.modalidad_pago='fiado' then v_compra.adelanto else v_compra.total end;
    if v_egreso>0 then
      insert into public.movimientos_caja(organization_id,fecha,tipo,medio,categoria,monto,descripcion,modulo_origen,
        referencia_id,tipo_comprobante,url_comprobante,created_by,updated_by)
      values(p_org,v_compra.fecha,'egreso','efectivo','compra_madera',v_egreso,
        case when v_compra.modalidad_pago='fiado' then 'Egreso por adelanto de compra fiada' else 'Egreso por compra de madera al contado' end,
        'compras_madera',v_id,case when v_compra.url_comprobante is null then 'ninguno' else 'boleta' end,
        v_compra.url_comprobante,p_actor,p_actor);
    end if;
  end if;
  return v_id;
end $$;
revoke all on function public.crear_compra_madera_con_caja(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.crear_compra_madera_con_caja(uuid,uuid,jsonb) to service_role;

-- Reconoce adelantos antiguos vinculados a la orden y los de la copia local vinculados a la cotización.
create or replace function public.cobrado_cotizacion(p_org uuid,p_cot uuid,p_unificada boolean)
returns numeric language sql stable security invoker set search_path=pg_catalog,public as $$
  select coalesce(sum(case when m.tipo::text='ingreso' then m.monto when m.tipo::text='egreso' then -m.monto else 0 end),0)
  from public.movimientos_caja m
  where m.organization_id=p_org and m.voided_at is null and m.deleted_at is null and not m.es_personal
  and ((m.referencia_id=p_cot and m.modulo_origen=case when p_unificada then 'cotizacion_unificada' else 'muebles_corte' end)
    or (m.modulo_origen='ventas' and m.categoria='adelanto_mueble_personalizado'
      and (m.referencia_id=p_cot or exists(select 1 from public.ordenes_produccion o where o.organization_id=p_org
        and o.id=m.referencia_id and case when p_unificada then o.cotizacion_unificada_id=p_cot else o.cotizacion_id=p_cot end))));
$$;
revoke all on function public.cobrado_cotizacion(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.cobrado_cotizacion(uuid,uuid,boolean) to service_role;

create or replace function public.consultar_cobro_cotizacion(p_org uuid,p_actor uuid,p_cot uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_total numeric; v_cobrado numeric;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','ventas']);
  select total into v_total from public.cotizaciones_unificadas where organization_id=p_org and id=p_cot and deleted_at is null;
  if not found then raise exception 'Cotización no encontrada'; end if;
  v_cobrado:=public.cobrado_cotizacion(p_org,p_cot,true);
  if v_total<=0 or v_cobrado<0 or v_cobrado>v_total then raise exception 'Revisa los cobros vinculados a esta cotización antes de continuar'; end if;
  return jsonb_build_object('total',v_total,'cobrado',v_cobrado,'saldo',v_total-v_cobrado);
end $$;
revoke all on function public.consultar_cobro_cotizacion(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.consultar_cobro_cotizacion(uuid,uuid,uuid) to service_role;

create or replace function public.registrar_cobro_cotizacion_seguro(p_org uuid,p_actor uuid,p_cot uuid,
  p_total_esperado numeric,p_saldo_esperado numeric,p_medio text,p_fecha date)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_cot public.cotizaciones_unificadas%rowtype; v_saldo numeric;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','ventas']);
  select * into v_cot from public.cotizaciones_unificadas where organization_id=p_org and id=p_cot and deleted_at is null for update;
  if not found then raise exception 'Cotización no encontrada'; end if;
  if v_cot.estado_flujo not in ('lista_produccion','en_produccion') then raise exception 'La cotización cambió o ya está cobrada. Actualiza antes de cobrar.'; end if;
  if v_cot.total is distinct from p_total_esperado then raise exception 'El total cambió. Actualiza antes de cobrar.'; end if;
  v_saldo:=v_cot.total-public.cobrado_cotizacion(p_org,p_cot,true);
  if v_saldo<=0 or v_saldo>v_cot.total then raise exception 'Esta cotización ya tiene un cobro completo o requiere revisión'; end if;
  if v_saldo is distinct from p_saldo_esperado then raise exception 'El saldo cambió. Actualiza los cobros antes de confirmar.'; end if;
  insert into public.movimientos_caja(organization_id,fecha,tipo,medio,categoria,monto,descripcion,modulo_origen,referencia_id,es_personal,created_by,updated_by)
  values(p_org,p_fecha,'ingreso',p_medio::public.medio_pago,'cotizaciones',v_saldo,
    'Cobro cotización '||coalesce(v_cot.correlativo,left(p_cot::text,8)),'cotizacion_unificada',p_cot,false,p_actor,p_actor);
  update public.cotizaciones_unificadas set estado_flujo='cobrada' where id=p_cot and organization_id=p_org;
end $$;
revoke all on function public.registrar_cobro_cotizacion_seguro(uuid,uuid,uuid,numeric,numeric,text,date) from public,anon,authenticated;
grant execute on function public.registrar_cobro_cotizacion_seguro(uuid,uuid,uuid,numeric,numeric,text,date) to service_role;

create or replace function public.aprobar_cotizacion_con_adelanto(p_org uuid,p_actor uuid,p_cot uuid,p_unificada boolean,
  p_total_esperado numeric,p_adelanto numeric,p_medio text,p_orden jsonb)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_total numeric; v_cliente uuid; v_estado text; v_id uuid;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','ventas']);
  if p_unificada then
    select total,cliente_id,estado_flujo into v_total,v_cliente,v_estado from public.cotizaciones_unificadas
      where id=p_cot and organization_id=p_org and deleted_at is null for update;
  else
    select precio_acordado,cliente_id,estado::text into v_total,v_cliente,v_estado from public.cotizaciones_mueble
      where id=p_cot and organization_id=p_org for update;
  end if;
  if not found then raise exception 'Cotización no encontrada'; end if;
  if (p_unificada and v_estado not in ('lista_produccion','en_produccion')) or (not p_unificada and v_estado<>'confirmada') then
    raise exception 'Solo se puede aprobar una cotización aceptada y sin cobro completo';
  end if;
  if v_total is distinct from p_total_esperado then raise exception 'El total cambió. Actualiza la cotización.'; end if;
  if exists(select 1 from public.ordenes_produccion where organization_id=p_org
    and case when p_unificada then cotizacion_unificada_id=p_cot else cotizacion_id=p_cot end) then
    raise exception 'Esta cotización ya tiene una orden de producción';
  end if;
  if p_adelanto is null or p_adelanto<0 or p_adelanto>v_total-public.cobrado_cotizacion(p_org,p_cot,p_unificada) then
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
  if p_unificada then update public.cotizaciones_unificadas set estado_flujo='en_produccion' where id=p_cot and organization_id=p_org; end if;
  return v_id;
end $$;
revoke all on function public.aprobar_cotizacion_con_adelanto(uuid,uuid,uuid,boolean,numeric,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function public.aprobar_cotizacion_con_adelanto(uuid,uuid,uuid,boolean,numeric,numeric,text,jsonb) to service_role;

-- La fórmula de penalidades permanece en la acción; se verifica que su base no cambió.
create or replace function public.cerrar_alquiler_con_caja(p_org uuid,p_actor uuid,p_contrato uuid,p_fecha date,
  p_observaciones text,p_snapshot_esperado jsonb,p_penalidad numeric)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_row public.alquileres%rowtype; v_snapshot jsonb; v_saldo numeric; v_medio text;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','almacen','ventas']);
  select * into v_row from public.alquileres where id=p_contrato and organization_id=p_org for update;
  if not found then raise exception 'Contrato no encontrado'; end if;
  if v_row.estado='cerrado' then raise exception 'El contrato ya está cerrado'; end if;
  v_snapshot:=jsonb_build_object('monto_total',v_row.monto_total,'deposito_30',v_row.deposito_30,'penalidad',v_row.penalidad,
    'retraso_pct',v_row.penalidad_retraso_pago_pct,'devolucion_pct',v_row.penalidad_devolucion_tardia_pct,
    'danios_pct',v_row.penalidad_danios_pct,'metodo_pago',v_row.metodo_pago);
  if v_snapshot is distinct from p_snapshot_esperado then raise exception 'El contrato cambió. Actualiza antes de cerrar.'; end if;
  if p_penalidad is null or p_penalidad<0 then raise exception 'Penalidad inválida'; end if;
  v_saldo:=coalesce(v_row.monto_total,0)-coalesce(v_row.deposito_30,0);
  if v_saldo<0 then raise exception 'Revisa el depósito del contrato antes de cerrar'; end if;
  if p_penalidad>0 then
    insert into public.movimientos_caja(organization_id,fecha,tipo,medio,categoria,monto,descripcion,modulo_origen,referencia_id,created_by,updated_by)
    values(p_org,p_fecha,'ingreso','efectivo','penalidad_alquiler',p_penalidad,
      'Penalidad cierre contrato '||coalesce(v_row.codigo,left(p_contrato::text,8)),'ventas_alquiler',p_contrato,p_actor,p_actor);
  end if;
  v_medio:=case coalesce(v_row.metodo_pago,'efectivo') when 'efectivo' then 'efectivo' when 'yape' then 'yape'
    when 'billetera_digital' then 'yape' when 'transferencia' then 'banco' else 'otro' end;
  if v_saldo>0 then
    insert into public.movimientos_caja(organization_id,fecha,tipo,medio,categoria,monto,descripcion,modulo_origen,referencia_id,created_by,updated_by)
    values(p_org,p_fecha,'ingreso',v_medio::public.medio_pago,'alquiler_bomba_mixer',v_saldo,
      'Saldo final contrato '||coalesce(v_row.codigo,left(p_contrato::text,8)),'ventas_alquiler',p_contrato,p_actor,p_actor);
  end if;
  update public.alquileres set estado='cerrado',fecha_fin=p_fecha,
    observaciones_retorno=coalesce(nullif(btrim(p_observaciones),''),observaciones_retorno),penalidad=coalesce(penalidad,0)+p_penalidad
    where id=p_contrato and organization_id=p_org;
end $$;
revoke all on function public.cerrar_alquiler_con_caja(uuid,uuid,uuid,date,text,jsonb,numeric) from public,anon,authenticated;
grant execute on function public.cerrar_alquiler_con_caja(uuid,uuid,uuid,date,text,jsonb,numeric) to service_role;
create or replace function public.editar_aserradero_con_caja(p_org uuid,p_actor uuid,p_servicio_id uuid,
  p_snapshot_esperado jsonb,p_servicio jsonb,p_monto_caja numeric)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_row public.servicios_aserradero%rowtype; v_caja public.movimientos_caja%rowtype; v_snapshot jsonb; v_count int;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','ventas']);
  select * into v_row from public.servicios_aserradero where id=p_servicio_id and organization_id=p_org for update;
  if not found then raise exception 'Servicio no encontrado'; end if;
  v_snapshot:=jsonb_build_object('precio_cobrado',v_row.precio_cobrado,'metodo_pago',v_row.metodo_pago,
    'modalidad_pago',v_row.modalidad_pago,'adelanto',v_row.adelanto);
  if v_snapshot is distinct from p_snapshot_esperado then raise exception 'El servicio cambió. Actualiza antes de guardar.'; end if;
  perform 1 from public.movimientos_caja where organization_id=p_org and referencia_id=p_servicio_id
    and modulo_origen='ventas_aserradero' and voided_at is null and deleted_at is null for update;
  select count(*) into v_count from public.movimientos_caja where organization_id=p_org and referencia_id=p_servicio_id
    and modulo_origen='ventas_aserradero' and voided_at is null and deleted_at is null;
  if v_count>1 then raise exception 'Revisa los movimientos vinculados al servicio antes de editar'; end if;
  select * into v_caja from public.movimientos_caja where organization_id=p_org and referencia_id=p_servicio_id
    and modulo_origen='ventas_aserradero' and voided_at is null and deleted_at is null;
  if v_caja.periodo_cerrado then raise exception 'El movimiento pertenece a un período cerrado'; end if;
  if not exists(select 1 from public.clientes where organization_id=p_org and id=(p_servicio->>'cliente_id')::uuid) then raise exception 'Cliente no encontrado'; end if;
  if p_monto_caja is null or p_monto_caja<0 or p_monto_caja>(p_servicio->>'precio_cobrado')::numeric then raise exception 'Cobro inválido'; end if;
  update public.servicios_aserradero set cliente_id=(p_servicio->>'cliente_id')::uuid,fecha=(p_servicio->>'fecha')::date,
    pies_cubicos=(p_servicio->>'pies_cubicos')::numeric,costo_cubicaje=(p_servicio->>'costo_cubicaje')::numeric,
    precio_cobrado=(p_servicio->>'precio_cobrado')::numeric,lineas_json=p_servicio->'lineas_json',
    metodo_pago=p_servicio->>'metodo_pago',modalidad_pago=p_servicio->>'modalidad_pago',
    adelanto=(p_servicio->>'adelanto')::numeric,fecha_pago_credito=(p_servicio->>'fecha_pago_credito')::date
    where id=p_servicio_id and organization_id=p_org;
  if p_monto_caja>0 then
    if v_caja.id is not null then
      update public.movimientos_caja set fecha=(p_servicio->>'fecha')::date,monto=p_monto_caja,
        medio=(p_servicio->>'medio_caja')::public.medio_pago,descripcion=p_servicio->>'descripcion_caja',updated_by=p_actor
        where id=v_caja.id;
    else
      insert into public.movimientos_caja(organization_id,fecha,tipo,medio,categoria,monto,descripcion,modulo_origen,referencia_id,created_by,updated_by)
      values(p_org,(p_servicio->>'fecha')::date,'ingreso',(p_servicio->>'medio_caja')::public.medio_pago,'servicio_aserradero',
        p_monto_caja,p_servicio->>'descripcion_caja','ventas_aserradero',p_servicio_id,p_actor,p_actor);
    end if;
  elsif v_caja.id is not null then
    delete from public.movimientos_caja where id=v_caja.id;
  end if;
end $$;
revoke all on function public.editar_aserradero_con_caja(uuid,uuid,uuid,jsonb,jsonb,numeric) from public,anon,authenticated;
grant execute on function public.editar_aserradero_con_caja(uuid,uuid,uuid,jsonb,jsonb,numeric) to service_role;
commit;

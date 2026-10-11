-- Protege nuevos envíos y borrados. No reescribe cotizaciones ni Caja del negocio.
begin;

-- Muebles personalizados: confirmada significa aceptada/lista para producción.
-- Se conserva el ingreso heredado de servicio_corte; no cambia su fórmula ni importe.
create or replace function public.cotizacion_insertar_movimiento_caja()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if new.tipo='servicio_corte' and new.estado='confirmada' then
    insert into public.movimientos_caja(organization_id,fecha,tipo,medio,categoria,monto,descripcion,
      modulo_origen,referencia_id,created_by,updated_by)
    values(new.organization_id,new.fecha,'ingreso','efectivo','servicio_corte_mueble',new.precio_acordado,
      'Ingreso automático por cotización confirmada','muebles_corte',new.id,auth.uid(),auth.uid());
  end if;
  return new;
end $$;

create or replace function public.registrar_cotizacion_rapida_segura(p_org uuid,p_actor uuid,p_clave uuid,p_datos jsonb)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_previa public.operaciones_financieras_seguras%rowtype; v_firma text; v_id uuid;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','ventas']);
  if p_clave is null or p_datos is null then raise exception 'Solicitud de cotización inválida.'; end if;
  v_firma:=md5((p_datos-'correlativo')::text);
  select * into v_previa from public.operaciones_financieras_seguras where id=p_clave;
  if found then
    if v_previa.organization_id<>p_org or v_previa.tipo<>'cotizacion_rapida' or v_previa.firma<>v_firma then
      raise exception 'Esta solicitud ya se guardó con otros datos. Abre un formulario nuevo.';
    end if;
    if not exists(select 1 from public.cotizaciones_mueble where id=v_previa.resultado_id and organization_id=p_org) then
      raise exception 'La cotización de este envío ya fue eliminada. Abre un formulario nuevo.';
    end if;
    return v_previa.resultado_id;
  end if;
  if not exists(select 1 from public.clientes where id=(p_datos->>'cliente_id')::uuid and organization_id=p_org) then
    raise exception 'Cliente no encontrado en esta empresa.';
  end if;
  if (p_datos->>'precio_acordado')::numeric is null or (p_datos->>'precio_acordado')::numeric<=0
    or (p_datos->>'precio_calculado')::numeric is null or (p_datos->>'precio_calculado')::numeric<0
    or p_datos->>'fecha' is null then raise exception 'Datos de cotización inválidos.'; end if;
  insert into public.cotizaciones_mueble(id,organization_id,cliente_id,fecha,tipo,especie_madera,unidad_medida,
    origen_material,precio_calculado,precio_acordado,motivo_ajuste,estado)
  values(p_clave,p_org,(p_datos->>'cliente_id')::uuid,(p_datos->>'fecha')::date,
    (p_datos->>'tipo')::public.tipo_cotizacion,p_datos->>'especie_madera',(p_datos->>'unidad_medida')::public.unidad_medida,
    'cliente',(p_datos->>'precio_calculado')::numeric,(p_datos->>'precio_acordado')::numeric,p_datos->>'motivo_ajuste',
    (p_datos->>'estado')::public.estado_documento) returning id into v_id;
  insert into public.operaciones_financieras_seguras(id,organization_id,tipo,firma,resultado_id)
    values(p_clave,p_org,'cotizacion_rapida',v_firma,v_id);
  return v_id;
end $$;

create or replace function public.eliminar_cotizacion_mueble_segura(p_org uuid,p_actor uuid,p_id uuid)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_cot public.cotizaciones_mueble%rowtype; v_estado text;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','ventas']);
  select * into v_cot from public.cotizaciones_mueble where id=p_id and organization_id=p_org for update;
  if not found then raise exception 'Cotización no encontrada.'; end if;
  if v_cot.tipo<>'mueble_personalizado' then
    raise exception 'Solo se pueden eliminar cotizaciones de mueble personalizado desde este listado.';
  end if;
  -- Conservar también movimientos anulados: su documento sigue siendo parte de la trazabilidad.
  if exists(select 1 from public.movimientos_caja where organization_id=p_org and referencia_id=p_id) then
    raise exception 'Esta cotización tiene movimientos en Caja. Conserva el documento y revisa los cobros antes de corregirla.';
  end if;
  if exists(select 1 from public.ordenes_produccion where organization_id=p_org and cotizacion_id=p_id) then
    raise exception 'No se puede eliminar: hay una orden de producción vinculada.';
  end if;
  select estado::text into v_estado from public.clientes where id=v_cot.cliente_id and organization_id=p_org for update;
  if not found then raise exception 'Cliente no encontrado en esta empresa.'; end if;
  if v_estado='activo' then raise exception 'El cliente está activo. Cambie su estado manualmente.'; end if;
  delete from public.cotizaciones_mueble where id=p_id and organization_id=p_org;
end $$;

revoke all on function public.registrar_cotizacion_rapida_segura(uuid,uuid,uuid,jsonb),
  public.eliminar_cotizacion_mueble_segura(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.registrar_cotizacion_rapida_segura(uuid,uuid,uuid,jsonb),
  public.eliminar_cotizacion_mueble_segura(uuid,uuid,uuid) to service_role;
commit;

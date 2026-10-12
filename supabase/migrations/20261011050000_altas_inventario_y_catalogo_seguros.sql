-- Corrige solicitudes nuevas; no modifica existencias ni documentos históricos al instalar.
begin;

create or replace function public.registrar_alta_inventario_segura(
  p_org uuid,p_actor uuid,p_tipo text,p_clave uuid,p_datos jsonb)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_previa public.operaciones_financieras_seguras%rowtype; v_firma text;
  v_id uuid; v_stock numeric; v_costo numeric; v_producto uuid;
  v_codigo text; v_prefijo text; v_secuencia numeric;
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','almacen','ventas']);
  if p_clave is null or p_tipo not in ('producto_inventario','movimiento_inventario')
    or jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Solicitud de inventario inválida'; end if;
  v_firma:=md5(p_datos::text);
  select * into v_previa from public.operaciones_financieras_seguras where id=p_clave;
  if found then
    if v_previa.organization_id<>p_org or v_previa.tipo<>p_tipo or v_previa.firma<>v_firma then
      raise exception 'Este envío ya se guardó con otros datos. Abre un formulario nuevo.';
    end if;
    if (p_tipo='producto_inventario' and not exists(select 1 from public.inventario_productos where id=v_previa.resultado_id and organization_id=p_org))
      or (p_tipo='movimiento_inventario' and not exists(select 1 from public.inventario_movimientos where id=v_previa.resultado_id and organization_id=p_org)) then
      raise exception 'Este envío ya se guardó y después se eliminó. Abre un formulario nuevo.';
    end if;
    return v_previa.resultado_id;
  end if;
  if nullif(p_datos->>'fecha','') is null then raise exception 'Fecha de inventario requerida'; end if;
  v_costo:=nullif(p_datos->>'costo_unitario','')::numeric;
  if v_costo<0 or v_costo::text in ('NaN','Infinity','-Infinity') then raise exception 'Costo de inventario inválido'; end if;
  if p_tipo='producto_inventario' then
    v_stock:=(p_datos->>'stock_inicial')::numeric;
    if v_stock is null or v_stock<0 or v_stock::text in ('NaN','Infinity','-Infinity')
      or length(trim(p_datos->>'codigo'))<2 or length(trim(p_datos->>'nombre'))<2
      or nullif(trim(p_datos->>'categoria'),'') is null or nullif(trim(p_datos->>'unidad'),'') is null
      or (p_datos->>'stock_minimo')::numeric<0 then raise exception 'Datos de producto inválidos'; end if;
    v_codigo:=p_datos->>'codigo';
    if p_datos->'codigo_automatico'='true'::jsonb then
      if v_codigo !~ '^[A-Z]{3}-[A-Z]{3}-[0-9]{4}-###$' then raise exception 'Código sugerido inválido'; end if;
      v_prefijo:=left(v_codigo,length(v_codigo)-3);
      -- El bloqueo de empresa ya tomado evita dos asignaciones de la misma secuencia.
      select coalesce(max(substring(codigo from length(v_prefijo)+1)::numeric),0)+1 into v_secuencia
        from public.inventario_productos where organization_id=p_org
        and left(codigo,length(v_prefijo))=v_prefijo and substring(codigo from length(v_prefijo)+1) ~ '^[0-9]+$';
      v_codigo:=v_prefijo||lpad(v_secuencia::text,greatest(3,length(v_secuencia::text)),'0');
    end if;
    insert into public.inventario_productos(id,organization_id,codigo,nombre,categoria,unidad,stock_actual,stock_minimo,foto_url,costo_unitario,activo)
    values(p_clave,p_org,v_codigo,p_datos->>'nombre',p_datos->>'categoria',p_datos->>'unidad',0,
      (p_datos->>'stock_minimo')::numeric,p_datos->>'foto_url',v_costo,true) returning id into v_id;
    if v_stock>0 then
      perform public.insertar_fila_operacion('inventario_movimientos',jsonb_build_object('organization_id',p_org,'producto_id',v_id,
        'fecha',p_datos->>'fecha','tipo','entrada_compra','cantidad',v_stock,'costo_unitario',v_costo,'referencia','Carga inicial de inventario'));
    end if;
  else
    v_producto:=(p_datos->>'producto_id')::uuid; v_stock:=(p_datos->>'cantidad')::numeric;
    if v_stock is null or v_stock<=0 or v_stock::text in ('NaN','Infinity','-Infinity')
      or (p_datos->>'tipo') is null or p_datos->>'tipo' not in ('entrada_compra','salida_venta','ajuste') then
      raise exception 'Movimiento de inventario inválido';
    end if;
    perform 1 from public.inventario_productos where id=v_producto and organization_id=p_org and deleted_at is null for no key update;
    if not found then raise exception 'Producto no encontrado en esta empresa'; end if;
    v_id:=public.insertar_fila_operacion('inventario_movimientos',jsonb_build_object('id',p_clave,'organization_id',p_org,
      'producto_id',v_producto,'fecha',p_datos->>'fecha','tipo',p_datos->>'tipo','cantidad',v_stock,
      'costo_unitario',v_costo,'referencia',p_datos->>'referencia'));
  end if;
  insert into public.operaciones_financieras_seguras(id,organization_id,tipo,firma,resultado_id) values(p_clave,p_org,p_tipo,v_firma,v_id);
  return v_id;
end $$;

-- Foto por identidad; productos con el mismo nombre o código no reciben cambios ajenos.
create or replace function public.editar_mueble_catalogo_seguro(p_org uuid,p_actor uuid,p_id uuid,p_datos jsonb)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  perform public.comprobar_autor_financiero(p_org,p_actor,array['owner_admin','gerencia','ventas']);
  perform 1 from public.muebles_catalogo where id=p_id and organization_id=p_org for update;
  if not found then raise exception 'Mueble no encontrado'; end if;
  if (p_datos->>'precio_lista')::numeric is null or (p_datos->>'precio_lista')::numeric<0 then raise exception 'Precio de catálogo inválido'; end if;
  update public.muebles_catalogo set descripcion=p_datos->>'descripcion',precio_lista=(p_datos->>'precio_lista')::numeric,
    foto_url=p_datos->>'foto_url' where id=p_id and organization_id=p_org;
  update public.inventario_productos set foto_url=p_datos->>'foto_url' where id=p_id and organization_id=p_org;
  return p_id;
end $$;

revoke all on function public.registrar_alta_inventario_segura(uuid,uuid,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.editar_mueble_catalogo_seguro(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.registrar_alta_inventario_segura(uuid,uuid,text,uuid,jsonb) to service_role;
grant execute on function public.editar_mueble_catalogo_seguro(uuid,uuid,uuid,jsonb) to service_role;
commit;

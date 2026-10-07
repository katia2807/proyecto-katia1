-- Instala operaciones atómicas; no limpia ni repara registros al instalarse.
begin;
create or replace function public.limpiar_datos_operativos_atomico(p_organization_id uuid, p_user_id uuid, p_user_name text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_table text;
  v_tables text[] := array['compras_madera','ventas_mueble_terminado','ventas_madera_cortada','servicios_aserradero','alquileres','ordenes_produccion','sueldos','adelantos','movimientos_caja','registros_generales','alertas_operativas','notifications','ventas_madera','cotizaciones_mueble','cotizaciones_unificadas','inventario_movimientos','registro_categorias','security_control_items','servicios_especiales_tarifa','zonas_entrega','unidades_medida','clientes','proveedores','choferes','empleados','periodos_nomina','muebles_catalogo','inventario_productos','productos_madera','cierres_mensuales','correlativos'];
begin
  if not exists(select 1 from public.perfiles where user_id=p_user_id and organization_id=p_organization_id and deactivated_at is null and (ui_role='owner_admin' or (ui_role is null and role::text='owner_admin'))) then raise exception 'No autorizado'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text,0));
  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I',v_table)) is not null then
      execute format('delete from public.%I where %I=$1',v_table,case when v_table='correlativos' then 'org_id' else 'organization_id' end) using p_organization_id;
    end if;
  end loop;
  -- Un fallo del registro revierte también todos los borrados. No borrar auditoría previa.
  insert into public.audit_logs(organization_id,user_id,user_name,accion,modulo,detalles)
  values(p_organization_id,p_user_id,p_user_name,'DATABASE_RESET','database',jsonb_build_object('tablas',v_tables));
end $$;
revoke all on function public.limpiar_datos_operativos_atomico(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.limpiar_datos_operativos_atomico(uuid,uuid,text) to service_role;

-- Un ajuste descendente registra su diferencia negativa; entradas y salidas usan cantidades positivas.
alter table public.inventario_movimientos drop constraint if exists inventario_movimientos_cantidad_check;
alter table public.inventario_movimientos add constraint inventario_movimientos_cantidad_check
  check ((tipo='ajuste' and cantidad<>0) or (tipo in ('entrada_compra','salida_venta') and cantidad>0)) not valid;

create or replace function public.importar_producto_inventario(p_organization_id uuid,p_user_id uuid,p_producto jsonb,p_por_nombre boolean,p_fecha date)
returns text language plpgsql security definer set search_path = pg_catalog,public as $$
declare v_id uuid; v_stock numeric; v_target numeric; v_count integer;
begin
  if not exists(select 1 from public.perfiles where user_id=p_user_id and organization_id=p_organization_id and deactivated_at is null and (ui_role in ('owner_admin','operaciones') or (ui_role is null and role::text in ('owner_admin','gerencia')))) then raise exception 'No autorizado'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||coalesce(p_producto->>'codigo',''),0));
  select count(*) into v_count from public.inventario_productos where organization_id=p_organization_id and deleted_at is null and (case when p_por_nombre then nombre=p_producto->>'nombre' else codigo=p_producto->>'codigo' end);
  if v_count>1 then raise exception 'Hay varios productos con el mismo nombre; usa su código'; end if;
  select id,stock_actual into v_id,v_stock from public.inventario_productos where organization_id=p_organization_id and deleted_at is null and (case when p_por_nombre then nombre=p_producto->>'nombre' else codigo=p_producto->>'codigo' end) for update;
  v_target:=nullif(p_producto->>'stock_actual','')::numeric;
  if v_target<0 or nullif(p_producto->>'stock_minimo','')::numeric<0 or nullif(p_producto->>'costo_unitario','')::numeric<0 then raise exception 'Stock o costo inválido'; end if;
  if v_id is null then
    insert into public.inventario_productos(organization_id,codigo,nombre,categoria,unidad,stock_actual,stock_minimo,costo_unitario,activo)
    values(p_organization_id,p_producto->>'codigo',coalesce(nullif(p_producto->>'nombre',''),p_producto->>'codigo'),coalesce(nullif(p_producto->>'categoria',''),'General'),coalesce(nullif(p_producto->>'unidad',''),'und'),0,coalesce(nullif(p_producto->>'stock_minimo','')::numeric,0),nullif(p_producto->>'costo_unitario','')::numeric,coalesce(nullif(p_producto->>'activo','')::boolean,true)) returning id into v_id;
    v_stock:=0;
  else
    update public.inventario_productos set nombre=coalesce(nullif(p_producto->>'nombre',''),nombre),categoria=coalesce(nullif(p_producto->>'categoria',''),categoria),unidad=coalesce(nullif(p_producto->>'unidad',''),unidad),stock_minimo=coalesce(nullif(p_producto->>'stock_minimo','')::numeric,stock_minimo),costo_unitario=coalesce(nullif(p_producto->>'costo_unitario','')::numeric,costo_unitario),activo=coalesce(nullif(p_producto->>'activo','')::boolean,activo) where id=v_id and organization_id=p_organization_id;
  end if;
  if v_target is not null and v_target<>v_stock then
    insert into public.inventario_movimientos(organization_id,producto_id,fecha,tipo,cantidad,costo_unitario,referencia)
    values(p_organization_id,v_id,p_fecha,'ajuste',v_target-v_stock,nullif(p_producto->>'costo_unitario','')::numeric,'Importación de Excel');
    -- Con y sin el trigger histórico: misma cifra final, sin aplicar dos veces el ajuste.
    update public.inventario_productos set stock_actual=v_target where id=v_id and organization_id=p_organization_id;
  end if;
  return case when v_count=0 then 'inserted' else 'updated' end;
end $$;
revoke all on function public.importar_producto_inventario(uuid,uuid,jsonb,boolean,date) from public,anon,authenticated;
grant execute on function public.importar_producto_inventario(uuid,uuid,jsonb,boolean,date) to service_role;

-- Validar envíos nuevos, conservando los registros históricos para revisión manual.
alter table public.sueldos add constraint sueldos_periodo_y_neto_validos check (periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and monto_bruto>0 and descuentos>=0 and descuentos<=monto_bruto and monto_neto=monto_bruto-descuentos) not valid;

-- Resultado de Caja de empresa; nómina informativa, sin descontarla dos veces.
create or replace view public.utilidad_mensual with (security_invoker=true) as
with movimientos as (
  select organization_id,extract(year from fecha)::int anio,extract(month from fecha)::int mes,
    sum(case when tipo='ingreso' then monto else 0 end) ingresos,
    sum(case when tipo='egreso' then monto else 0 end) egresos
  from public.movimientos_caja where voided_at is null and deleted_at is null and not coalesce(es_personal,false)
  group by organization_id,extract(year from fecha),extract(month from fecha)
), nomina as (
  select organization_id,split_part(periodo,'-',1)::int anio,split_part(periodo,'-',2)::int mes,sum(monto_neto) sueldos
  from public.sueldos where periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  group by organization_id,split_part(periodo,'-',1),split_part(periodo,'-',2)
)
select coalesce(m.organization_id,n.organization_id) organization_id,coalesce(m.anio,n.anio) anio,coalesce(m.mes,n.mes) mes,
  coalesce(m.ingresos,0)::numeric(12,2) ingresos,coalesce(m.egresos,0)::numeric(12,2) egresos,
  coalesce(n.sueldos,0)::numeric(12,2) sueldos,(coalesce(m.ingresos,0)-coalesce(m.egresos,0))::numeric(12,2) utilidad_neta
from movimientos m full outer join nomina n on m.organization_id=n.organization_id and m.anio=n.anio and m.mes=n.mes;
commit;

-- Estructura ficticia de la ruta rápida y el séptimo trigger heredado.
-- El trigger corresponde al esquema exportado antes de 1.1.75, sin registros del negocio.
create type public.tipo_cotizacion as enum('mueble_personalizado','servicio_corte');
create type public.unidad_medida as enum('cm','in','otro');
alter table cotizaciones_mueble alter column id set default gen_random_uuid();
alter table cotizaciones_mueble add column fecha date not null default current_date,
  add column tipo public.tipo_cotizacion not null default 'mueble_personalizado',
  add column especie_madera text not null default 'Ficticia',
  add column unidad_medida public.unidad_medida not null default 'cm',
  add column origen_material text not null default 'cliente',
  add column precio_calculado numeric(12,2) not null default 0,add column motivo_ajuste text;
alter table clientes add column estado text not null default 'activo';
alter table ordenes_produccion add constraint orden_cotizacion_mueble_fk
  foreign key(cotizacion_id) references cotizaciones_mueble(id) on delete restrict;
alter table ordenes_produccion add constraint orden_cotizacion_unificada_fk
  foreign key(cotizacion_unificada_id) references cotizaciones_unificadas(id) on delete set null;
alter table ordenes_produccion add constraint ordenes_produccion_origen_chk
  check(cotizacion_id is not null or cotizacion_unificada_id is not null);
create table cotizacion_cortes(id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid references cotizaciones_mueble(id) on delete cascade);

create function public.cotizacion_insertar_movimiento_caja() returns trigger language plpgsql as $$
begin
  if new.estado='confirmada' then
    insert into movimientos_caja(organization_id,fecha,tipo,medio,categoria,monto,descripcion,
      modulo_origen,referencia_id,created_by,updated_by)
    values(new.organization_id,new.fecha,'ingreso','efectivo','servicio_corte_mueble',new.precio_acordado,
      'Ingreso automático por cotización confirmada','muebles_corte',new.id,auth.uid(),auth.uid());
  end if;
  return new;
end $$;
create trigger trg_cotizacion_ingreso_caja after insert or update on cotizaciones_mueble
  for each row execute function cotizacion_insertar_movimiento_caja();

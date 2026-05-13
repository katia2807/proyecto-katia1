-- Asegura que public.inventario_movimientos.tipo acepte los valores que usa la app.
-- Si la tabla se creó con un CHECK distinto o sin él, esta migración lo alinea.
-- (En el repo original la columna es text + CHECK; si en producción usás otro esquema, revisá el resultado de
--   SELECT DISTINCT tipo FROM public.inventario_movimientos; en el SQL Editor.)

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventario_movimientos'
      and column_name = 'tipo'
      and data_type in ('text', 'character varying')
  ) then
    alter table public.inventario_movimientos
      drop constraint if exists inventario_movimientos_tipo_check;

    alter table public.inventario_movimientos
      add constraint inventario_movimientos_tipo_check
      check (tipo in ('entrada_compra', 'salida_venta', 'ajuste'));
  end if;
end $$;

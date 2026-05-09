-- La app registra el ingreso en caja al confirmar (como venta mueble terminado).
-- Se elimina el trigger legacy para evitar duplicar movimientos y se agrega correlativo.

drop trigger if exists trg_ventas_ingreso_caja on public.ventas_madera;

drop function if exists public.ventas_insertar_movimiento_caja();

alter table public.ventas_madera
  add column if not exists correlativo text;

comment on column public.ventas_madera.correlativo is 'Número visible tipo MA-AAAA-NNNN; descripción en caja "Venta madera <correlativo>".';

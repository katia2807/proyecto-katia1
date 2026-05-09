-- Marca egresos personales de la jefa (demo tenía el flag; alinea import/repetir con Excel export).
alter table public.movimientos_caja
  add column if not exists es_personal boolean not null default false;

comment on column public.movimientos_caja.es_personal is 'Gasto personal (no operativo); filtro en repetir gastos del mes anterior.';

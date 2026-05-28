alter table public.configuracion_empresa
  add column if not exists margen_ganancia_default_pct numeric not null default 30
  check (margen_ganancia_default_pct >= 0);

update public.configuracion_empresa
set margen_ganancia_default_pct = 30
where margen_ganancia_default_pct is null;

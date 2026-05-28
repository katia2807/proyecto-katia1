alter table public.configuracion_empresa
  add column if not exists firmante_cargo text not null default 'Gerente';

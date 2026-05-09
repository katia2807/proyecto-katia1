-- Contrato mixer (columnas en alquileres) + choferes + zonas de entrega.

alter table public.alquileres add column if not exists codigo text;
alter table public.alquileres add column if not exists representante text;
alter table public.alquileres add column if not exists ruc_empresa text;
alter table public.alquileres add column if not exists direccion_ejecucion text;
alter table public.alquileres add column if not exists fecha_termino date;
alter table public.alquileres add column if not exists dias_alquiler integer;
alter table public.alquileres add column if not exists tarifa_unidad text;
alter table public.alquileres add column if not exists monto_total numeric(14,2);
alter table public.alquileres add column if not exists deposito_30 numeric(14,2);
alter table public.alquileres add column if not exists penalidad_retraso_pago_pct numeric(8,3) not null default 3;
alter table public.alquileres add column if not exists penalidad_devolucion_tardia_pct numeric(8,3) not null default 3;
alter table public.alquileres add column if not exists penalidad_danios_pct numeric(8,3) not null default 3;
alter table public.alquileres add column if not exists observaciones_retorno text;
alter table public.alquileres add column if not exists metodo_pago text;
alter table public.alquileres add column if not exists modalidad_pago text;
alter table public.alquileres add column if not exists fecha_pago_credito date;

do $$
begin
  alter table public.alquileres
    add constraint alquileres_tarifa_unidad_chk
    check (tarifa_unidad is null or tarifa_unidad in ('hora_maquina', 'm3', 'dia'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.alquileres
    add constraint alquileres_metodo_pago_chk
    check (
      metodo_pago is null
      or metodo_pago in ('efectivo', 'yape', 'transferencia', 'billetera_digital', 'otro')
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.alquileres
    add constraint alquileres_modalidad_pago_chk
    check (modalidad_pago is null or modalidad_pago in ('contado', 'adelanto', 'credito'));
exception
  when duplicate_object then null;
end $$;

create table if not exists public.choferes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nombre text not null,
  telefono text,
  placa text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_choferes_org_nombre on public.choferes (organization_id, nombre);

create table if not exists public.zonas_entrega (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nombre text not null,
  distancia_km numeric(10,2) not null check (distancia_km >= 0),
  tarifa numeric(12,2) not null check (tarifa >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_zonas_entrega_org on public.zonas_entrega (organization_id);

alter table public.choferes enable row level security;
alter table public.zonas_entrega enable row level security;

create policy org_data_access_choferes on public.choferes
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

create policy org_data_access_zonas_entrega on public.zonas_entrega
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

comment on table public.choferes is 'Choferes para entregas (ventas).';
comment on table public.zonas_entrega is 'Tarifas por zona/distancia para logística.';

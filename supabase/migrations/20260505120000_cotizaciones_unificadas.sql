-- Cotizaciones multi-rubro (muebles / aserradero / alquiler) con detalle JSON.

do $$ begin
  create type estado_cotizacion_unificada as enum ('pendiente', 'lista_produccion', 'en_produccion');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.cotizaciones_unificadas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  fecha date not null default (timezone('utc', now()))::date,
  correlativo text,
  tipo_cliente text not null check (tipo_cliente in ('natural', 'empresa')),
  total numeric(14,2) not null default 0,
  estado_flujo public.estado_cotizacion_unificada not null default 'pendiente',
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cotiz_unif_org_fecha
  on public.cotizaciones_unificadas (organization_id, fecha desc);

create index if not exists idx_cotiz_unif_org_estado
  on public.cotizaciones_unificadas (organization_id, estado_flujo);

alter table public.cotizaciones_unificadas enable row level security;

create policy org_data_access_cotiz_unificadas on public.cotizaciones_unificadas
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

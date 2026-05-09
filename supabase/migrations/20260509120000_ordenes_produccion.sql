-- Órdenes de producción (cotización mueble / unificada → taller Kanban).

create table if not exists public.ordenes_produccion (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  cotizacion_id uuid references public.cotizaciones_mueble(id) on delete restrict,
  cotizacion_unificada_id uuid references public.cotizaciones_unificadas(id) on delete set null,
  estado text not null default 'en_produccion'
    check (estado in ('en_produccion', 'terminado', 'entregado')),
  notas text,
  fecha_aprobacion date not null default (timezone('utc', now()))::date,
  correlativo text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint ordenes_produccion_origen_chk check (
    cotizacion_id is not null or cotizacion_unificada_id is not null
  )
);

create index if not exists idx_ordenes_prod_org_created
  on public.ordenes_produccion (organization_id, created_at desc);

create index if not exists idx_ordenes_prod_org_estado
  on public.ordenes_produccion (organization_id, estado);

create unique index if not exists ordenes_produccion_unique_cot_mueble
  on public.ordenes_produccion (organization_id, cotizacion_id)
  where cotizacion_id is not null;

create unique index if not exists ordenes_produccion_unique_cot_unif
  on public.ordenes_produccion (organization_id, cotizacion_unificada_id)
  where cotizacion_unificada_id is not null;

alter table public.ordenes_produccion enable row level security;

create policy org_data_access_ordenes_produccion on public.ordenes_produccion
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

comment on table public.ordenes_produccion is 'Órdenes de taller desde cotizaciones; estados Kanban en_produccion / terminado / entregado.';

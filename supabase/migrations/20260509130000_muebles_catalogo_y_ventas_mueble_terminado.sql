-- Catálogo de muebles terminados y ventas asociadas (ingreso caja + stock).

create table if not exists public.muebles_catalogo (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  descripcion text,
  precio_lista numeric(12,2) not null default 0,
  stock_disponible integer not null default 0 check (stock_disponible >= 0),
  foto_url text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, codigo)
);

create index if not exists idx_muebles_catalogo_org on public.muebles_catalogo (organization_id);

create table if not exists public.ventas_mueble_terminado (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  mueble_catalogo_id uuid not null references public.muebles_catalogo(id) on delete restrict,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario > 0),
  total numeric(12,2) not null check (total > 0),
  chofer_id uuid,
  tipo_entrega text not null
    check (tipo_entrega in ('puesto_en_obra', 'entrega_local', 'envio')),
  direccion_entrega text,
  estado_entrega text not null default 'pendiente'
    check (estado_entrega in ('pendiente', 'en_proceso', 'entregado')),
  metodo_pago text not null
    check (metodo_pago in ('efectivo', 'yape', 'transferencia', 'billetera_digital', 'otro')),
  modalidad_pago text not null
    check (modalidad_pago in ('contado', 'adelanto', 'credito')),
  fecha_pago_credito date,
  correlativo text,
  fecha date not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists idx_ventas_mueble_term_org_fecha
  on public.ventas_mueble_terminado (organization_id, fecha desc);

alter table public.muebles_catalogo enable row level security;
alter table public.ventas_mueble_terminado enable row level security;

create policy org_data_access_muebles_catalogo on public.muebles_catalogo
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

create policy org_data_access_ventas_mueble_terminado on public.ventas_mueble_terminado
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

comment on table public.muebles_catalogo is 'Catálogo de muebles listos; stock_disponible se descuenta al vender.';
comment on table public.ventas_mueble_terminado is 'Ventas de mueble terminado; ingreso en caja salvo modalidad crédito (misma regla que demo local).';

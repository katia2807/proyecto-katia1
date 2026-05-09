-- Servicios de aserradero (cubicaje + líneas JSON) y ventas de madera cortada (PT + caja + inventario opcional).

create table if not exists public.servicios_aserradero (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  fecha date not null,
  pies_cubicos numeric(14,4) not null check (pies_cubicos > 0),
  costo_cubicaje numeric(12,2) not null check (costo_cubicaje >= 0),
  precio_cobrado numeric(12,2) not null check (precio_cobrado > 0),
  utilidad numeric(12,2) not null,
  lineas_json jsonb not null default '[]'::jsonb,
  correlativo text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_servicios_aserradero_org_fecha
  on public.servicios_aserradero (organization_id, fecha desc);

create table if not exists public.ventas_madera_cortada (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  fecha date not null,
  estado public.estado_documento not null default 'confirmada',
  tipo_corte text not null
    check (tipo_corte in ('tabla', 'liston', 'cuarton', 'poste')),
  total_pt numeric(14,4) not null check (total_pt > 0),
  precio_por_pt numeric(12,4) not null check (precio_por_pt >= 0),
  total numeric(12,2) not null check (total >= 0),
  metodo_pago text not null
    check (metodo_pago in ('efectivo', 'yape', 'transferencia', 'billetera_digital', 'otro')),
  modalidad_pago text not null
    check (modalidad_pago in ('contado', 'adelanto', 'credito')),
  fecha_pago_credito date,
  chofer_id uuid,
  tipo_entrega text not null
    check (tipo_entrega in ('puesto_en_obra', 'entrega_local', 'envio')),
  direccion_entrega text,
  estado_entrega text not null default 'pendiente'
    check (estado_entrega in ('pendiente', 'en_proceso', 'entregado')),
  inventario_producto_id uuid references public.inventario_productos(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_ventas_madera_cortada_org_fecha
  on public.ventas_madera_cortada (organization_id, fecha desc);

alter table public.servicios_aserradero enable row level security;
alter table public.ventas_madera_cortada enable row level security;

create policy org_data_access_servicios_aserradero on public.servicios_aserradero
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

create policy org_data_access_ventas_madera_cortada on public.ventas_madera_cortada
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

comment on table public.servicios_aserradero is 'Cubicaje y procesos; ingreso caja por precio_cobrado (medio efectivo, igual que demo local).';
comment on table public.ventas_madera_cortada is 'Venta por pie tablar; ingreso en caja salvo modalidad crédito; salida de inventario opcional.';

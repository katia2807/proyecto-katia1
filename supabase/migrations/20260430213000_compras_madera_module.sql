create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nombre text not null,
  documento text,
  telefono text,
  created_at timestamptz not null default now()
);

create table if not exists public.compras_madera (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proveedor_id uuid not null references public.proveedores(id) on delete restrict,
  fecha date not null,
  especie_madera text not null,
  detalle text,
  cantidad numeric(12,2) not null check (cantidad > 0),
  unidad text not null default 'unidad',
  precio_unitario numeric(12,2) not null check (precio_unitario > 0),
  total numeric(12,2) not null check (total >= 0),
  modalidad_pago text not null default 'contado' check (modalidad_pago in ('contado', 'fiado')),
  adelanto numeric(12,2) not null default 0 check (adelanto >= 0),
  saldo_pendiente numeric(12,2) not null default 0 check (saldo_pendiente >= 0),
  estado estado_documento not null default 'borrador',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists proveedores_org_idx on public.proveedores(organization_id);
create index if not exists compras_madera_org_fecha_idx on public.compras_madera(organization_id, fecha desc);

alter table public.proveedores enable row level security;
alter table public.compras_madera enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'proveedores'
      and policyname = 'proveedores_org_access'
  ) then
    create policy proveedores_org_access
      on public.proveedores
      for all
      using (organization_id = app.current_org_id())
      with check (organization_id = app.current_org_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'compras_madera'
      and policyname = 'compras_madera_org_access'
  ) then
    create policy compras_madera_org_access
      on public.compras_madera
      for all
      using (organization_id = app.current_org_id())
      with check (organization_id = app.current_org_id());
  end if;
end $$;

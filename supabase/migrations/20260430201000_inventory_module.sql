create table if not exists public.inventario_productos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  categoria text not null,
  unidad text not null default 'unidad',
  stock_actual numeric(12,2) not null default 0,
  stock_minimo numeric(12,2) not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, codigo)
);

create table if not exists public.inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  producto_id uuid not null references public.inventario_productos(id) on delete restrict,
  fecha date not null,
  tipo text not null check (tipo in ('entrada_compra', 'salida_venta', 'ajuste')),
  cantidad numeric(12,2) not null check (cantidad > 0),
  costo_unitario numeric(12,2),
  referencia text,
  created_at timestamptz not null default now()
);

create index if not exists inventario_productos_org_idx on public.inventario_productos(organization_id);
create index if not exists inventario_movimientos_org_fecha_idx on public.inventario_movimientos(organization_id, fecha desc);

alter table public.inventario_productos enable row level security;
alter table public.inventario_movimientos enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'inventario_productos'
      and policyname = 'inventario_productos_org_access'
  ) then
    create policy inventario_productos_org_access
      on public.inventario_productos
      for all
      using (organization_id = app.current_org_id())
      with check (organization_id = app.current_org_id());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'inventario_movimientos'
      and policyname = 'inventario_movimientos_org_access'
  ) then
    create policy inventario_movimientos_org_access
      on public.inventario_movimientos
      for all
      using (organization_id = app.current_org_id())
      with check (organization_id = app.current_org_id());
  end if;
end $$;

create or replace function public.sync_stock_from_movimiento()
returns trigger
language plpgsql
as $$
declare
  delta numeric;
begin
  delta := case
    when new.tipo = 'entrada_compra' then new.cantidad
    when new.tipo = 'salida_venta' then -new.cantidad
    else new.cantidad
  end;

  update public.inventario_productos
    set stock_actual = greatest(0, stock_actual + delta)
  where id = new.producto_id
    and organization_id = new.organization_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_stock_from_movimiento on public.inventario_movimientos;
create trigger trg_sync_stock_from_movimiento
after insert on public.inventario_movimientos
for each row execute function public.sync_stock_from_movimiento();

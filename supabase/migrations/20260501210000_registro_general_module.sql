create table if not exists registro_categorias (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, codigo)
);

create table if not exists registros_generales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  categoria_id uuid not null references registro_categorias(id) on delete restrict,
  fecha date not null default current_date,
  titulo text not null,
  detalle text,
  monto numeric(12, 2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table registro_categorias enable row level security;
alter table registros_generales enable row level security;

create policy org_data_access_registro_categorias on registro_categorias
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

create policy org_data_access_registros_generales on registros_generales
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

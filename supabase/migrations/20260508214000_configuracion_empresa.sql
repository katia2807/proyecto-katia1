create table if not exists public.configuracion_empresa (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nombre text not null,
  ruc text not null,
  telefono text not null,
  direccion text not null,
  firmante text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create index if not exists idx_configuracion_empresa_org
  on public.configuracion_empresa (organization_id);

alter table public.configuracion_empresa enable row level security;

drop policy if exists org_data_access_configuracion_empresa on public.configuracion_empresa;
create policy org_data_access_configuracion_empresa on public.configuracion_empresa
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

insert into public.configuracion_empresa (
  organization_id,
  nombre,
  ruc,
  telefono,
  direccion,
  firmante
)
values (
  '00000000-0000-0000-0000-000000000001',
  'KATIA LIZZET MENESES TAYPE',
  '10739957520',
  '987 654 321',
  'Lima, Peru',
  'Katia Lizzet Meneses Taype'
)
on conflict (organization_id) do nothing;

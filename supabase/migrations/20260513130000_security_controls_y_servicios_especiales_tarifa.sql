-- Checklist de seguridad operativa (pantalla /seguridad) y tarifas de procesos especiales (aserradero).

create table if not exists public.security_control_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sort_order int not null default 0,
  title text not null,
  owner text not null default 'Equipo técnico',
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (organization_id, sort_order)
);

create index if not exists idx_security_control_items_org
  on public.security_control_items (organization_id, sort_order);

alter table public.security_control_items enable row level security;

drop policy if exists org_data_access_security_control_items on public.security_control_items;
create policy org_data_access_security_control_items on public.security_control_items
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

insert into public.security_control_items (id, organization_id, sort_order, title, owner, completed)
values
  ('a0000001-0001-4001-8001-000000000001', '00000000-0000-0000-0000-000000000001', 1, 'RLS habilitado en tablas críticas', 'Equipo técnico', true),
  ('a0000001-0001-4001-8001-000000000002', '00000000-0000-0000-0000-000000000001', 2, 'MFA activo para owner_admin y gerencia', 'Katia', false),
  ('a0000001-0001-4001-8001-000000000003', '00000000-0000-0000-0000-000000000001', 3, 'Anulación lógica con motivo obligatoria', 'Equipo técnico', true),
  ('a0000001-0001-4001-8001-000000000004', '00000000-0000-0000-0000-000000000001', 4, 'Backups y restore drill trimestral verificado', 'Equipo técnico', false)
on conflict (id) do nothing;

create table if not exists public.servicios_especiales_tarifa (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  tarifa_por_pieza numeric(12,4) not null check (tarifa_por_pieza >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, codigo)
);

create index if not exists idx_servicios_especiales_tarifa_org
  on public.servicios_especiales_tarifa (organization_id, activo);

alter table public.servicios_especiales_tarifa enable row level security;

drop policy if exists org_data_access_servicios_especiales_tarifa on public.servicios_especiales_tarifa;
create policy org_data_access_servicios_especiales_tarifa on public.servicios_especiales_tarifa
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

insert into public.servicios_especiales_tarifa (organization_id, codigo, nombre, tarifa_por_pieza, activo)
values
  ('00000000-0000-0000-0000-000000000001', 'SE-CEP', 'Cepillado', 2, true),
  ('00000000-0000-0000-0000-000000000001', 'SE-TRA', 'Traslapado', 2.5, true),
  ('00000000-0000-0000-0000-000000000001', 'SE-MAC', 'Machembrado', 3, true),
  ('00000000-0000-0000-0000-000000000001', 'SE-CV', 'Corte vertical', 1.5, true),
  ('00000000-0000-0000-0000-000000000001', 'SE-CH', 'Corte horizontal', 1.5, true)
on conflict (organization_id, codigo) do nothing;

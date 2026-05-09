-- Contadores por organización y tipo (clave textual: cotizacion, orden_produccion_2026, etc.)

create table if not exists public.correlativos (
  org_id text not null,
  tipo text not null,
  ultimo_valor integer not null default 0,
  constraint correlativos_pkey primary key (org_id, tipo)
);

create index if not exists correlativos_org_idx on public.correlativos (org_id);

alter table public.correlativos enable row level security;

create policy org_correlativos_select on public.correlativos
for select
using (org_id = app.current_org_id()::text);

create policy org_correlativos_all on public.correlativos
for all
using (org_id = app.current_org_id()::text)
with check (org_id = app.current_org_id()::text);

-- Incremento atómico: SELECT ... FOR UPDATE y luego UPDATE (sin duplicados concurrentes).
create or replace function public.next_correlativo_valor(p_org_id text, p_tipo text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
  _locked integer;
begin
  insert into public.correlativos (org_id, tipo, ultimo_valor)
  values (p_org_id, p_tipo, 0)
  on conflict (org_id, tipo) do nothing;

  select ultimo_valor into strict _locked
  from public.correlativos
  where org_id = p_org_id and tipo = p_tipo
  for update;

  update public.correlativos
  set ultimo_valor = ultimo_valor + 1
  where org_id = p_org_id and tipo = p_tipo
  returning ultimo_valor into v_next;

  return v_next;
end;
$$;

comment on table public.correlativos is 'Contadores serializados; usar next_correlativo_valor para incremento concurrente.';

grant execute on function public.next_correlativo_valor(text, text) to service_role;

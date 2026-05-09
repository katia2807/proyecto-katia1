-- Clientes genéricos para pruebas rápidas de cotización.
-- Idempotente: no duplica por organization_id + documento.

insert into clientes (organization_id, nombre, documento, telefono)
select
  '00000000-0000-0000-0000-000000000001',
  'Cliente Genérico Natural',
  '12345678',
  '900111222'
where not exists (
  select 1
  from clientes
  where organization_id = '00000000-0000-0000-0000-000000000001'
    and documento = '12345678'
);

insert into clientes (organization_id, nombre, documento, telefono)
select
  '00000000-0000-0000-0000-000000000001',
  'Cliente Genérico Empresa SAC',
  '20123456789',
  '900333444'
where not exists (
  select 1
  from clientes
  where organization_id = '00000000-0000-0000-0000-000000000001'
    and documento = '20123456789'
);
